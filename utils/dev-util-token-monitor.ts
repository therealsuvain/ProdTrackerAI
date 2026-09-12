import storageMMKV from '@/utils/Storage-Utils/mmkv-instance'
import { STORAGE_KEYS } from '@/utils/Storage-Utils/storage-keys'

const STORAGE_KEY = "AI_TOKEN_MONITOR_STATS";

type PipelineStats = {
  pipelineTokens: number;
  pipelineRequests: number;
};

type TokenStats = {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalRequests: number;
  totalPipelines: number;
  pipelines: PipelineStats[];
}

const DEFAULT_STATS: TokenStats = {
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  totalTokens: 0,
  totalRequests: 0,
  totalPipelines: 0,
  pipelines: [],
};

class TokenMonitor {
  private stats: TokenStats = {
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalRequests: 0,
    totalPipelines: 0,
    pipelines: [],
  };


  private initialized = false;

  // Prevent multiple simultaneous init() calls
  private initPromise: void | null = null;

  // Queue all record operations
  private recordQueue: Promise<void> = Promise.resolve();

  async init() {
    if (this.initialized) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (() => {
      try {
        const stored = storageMMKV.getString(STORAGE_KEY);

        if (stored) {
          const parsed = JSON.parse(stored);
          this.stats = {
            ...DEFAULT_STATS,
            ...parsed,
            pipelines: parsed.pipelines ?? [],
          };
        }
      } catch (err) {
        console.warn("TokenMonitor load failed:", err);
      }

      this.initialized = true;
    })();

     this.initPromise;
  }

  private persist() {
    try {
      storageMMKV.set(
        STORAGE_KEY,
        JSON.stringify(this.stats)
      );
    } catch (err) {
      console.warn("TokenMonitor save failed:", err);
    }
  }

 async record(
    {
      promptTokens = 0,
      completionTokens = 0,
      totalTokens,
    }: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    },
    source = "Unknown"
  ) {
    this.recordQueue = this.recordQueue.then(async () => {
      await this.init();

      const total =
        totalTokens ?? promptTokens + completionTokens;
      const isGatekeeper = source === "GATEKEEPER";
      this.stats.totalPromptTokens += promptTokens;
      this.stats.totalCompletionTokens += completionTokens;
      this.stats.totalTokens += total;
      this.stats.totalRequests++;

      // --- Pipeline stats ---
      if (isGatekeeper) {
        // Start a new pipeline bucket
        this.stats.totalPipelines++;
        this.stats.pipelines.push({
          pipelineTokens: total,
          pipelineRequests: 1,
        });
      } else {
        // Accumulate into the current (last) pipeline bucket
        const current = this.stats.pipelines[this.stats.pipelines.length - 1];
        if (current) {
          current.pipelineTokens += total;
          current.pipelineRequests++;
        }
      }

      const currentPipeline =
        this.stats.pipelines[this.stats.pipelines.length - 1];
      const pipelineNumber = this.stats.totalPipelines;
      const subRequest = currentPipeline?.pipelineRequests ?? 1;
      const avgTokens =
        this.stats.totalTokens / this.stats.totalRequests;
      const avgTokensPerPipeline =
        this.stats.totalPipelines > 0
          ? this.stats.pipelines.reduce((s, p) => s + p.pipelineTokens, 0) /
          this.stats.totalPipelines
          : 0;
      const avgRequestsPerPipeline =
        this.stats.totalPipelines > 0
          ? this.stats.pipelines.reduce((s, p) => s + p.pipelineRequests, 0) /
          this.stats.totalPipelines
          : 0;
      this.persist();

      console.log(" TOKEN MONITOR from:", source);
      console.log("----------------------------");
      console.log(` Pipeline Request #: ${pipelineNumber}.${subRequest}`);
      console.log("   Global Request #:", this.stats.totalRequests);
      console.log("      Prompt Tokens:", promptTokens);
      console.log("  Completion Tokens:", completionTokens);
      console.log("Current-Req. Tokens:", total);
      if (currentPipeline) {
        console.log(`    Pipeline Tokens: ${currentPipeline.pipelineTokens}  (${currentPipeline.pipelineRequests} requests)`);
      }
      console.log(" Avg Tokens/Request:", avgTokens.toFixed(2));
      console.log("Avg Tokens/Pipeline:", avgTokensPerPipeline.toFixed(2));
      console.log(" Avg Reqs./Pipeline:", avgRequestsPerPipeline.toFixed(2));
      console.log("  Total Tokens Used:", this.stats.totalTokens);
      console.log("----------------------------");
    });

    return this.recordQueue;
  }

  async getStats() {
    await this.init();
    return this.stats;
  }

  async reset() {
    await this.init();

    this.stats = { ...DEFAULT_STATS, pipelines: [] };

    storageMMKV.remove(STORAGE_KEY);
  }
}

export const tokenMonitor = new TokenMonitor();

export const recordGeminiUsage = async (
  response: any,
  source = "Unknown"
) => {
  const usage = response?.usageMetadata;

  if (!usage) {
    console.warn(
      "AI TOKEN MONITOR: Missing usageMetadata from",
      source
    );
    return;
  }

  await tokenMonitor.record(
    {
      promptTokens: usage.promptTokenCount ?? 0,
      completionTokens: usage.candidatesTokenCount ?? 0,
      totalTokens: usage.totalTokenCount ?? 0,
    },
    source
  );
};