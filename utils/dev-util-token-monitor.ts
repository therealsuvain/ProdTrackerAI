import AsyncStorage from "@react-native-async-storage/async-storage";

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
  private initPromise: Promise<void> | null = null;

  // Queue all record operations
  private recordQueue: Promise<void> = Promise.resolve();

  async init() {
    if (this.initialized) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);

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

    await this.initPromise;
  }

  private async persist() {
    try {
      await AsyncStorage.setItem(
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
      await this.persist();

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

    await AsyncStorage.removeItem(STORAGE_KEY);
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

// import AsyncStorage from "@react-native-async-storage/async-storage";

// const STORAGE_KEY = "AI_TOKEN_MONITOR_STATS";

// type TokenStats = {
//   totalPromptTokens: number;
//   totalCompletionTokens: number;
//   totalTokens: number;
//   totalRequests: number;
// };

// class TokenMonitor {
//   private stats: TokenStats = {
//     totalPromptTokens: 0,
//     totalCompletionTokens: 0,
//     totalTokens: 0,
//     totalRequests: 0,
//   };

//   private initialized = false;

//   async init() {
//     if (this.initialized) return;

//     try {
//       const stored = await AsyncStorage.getItem(STORAGE_KEY);

//       if (stored) {
//         this.stats = JSON.parse(stored);
//       }
//     } catch (err) {
//       console.warn("TokenMonitor load failed:", err);
//     }

//     this.initialized = true;
//   }

//   private async persist() {
//     try {
//       await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
//     } catch (err) {
//       console.warn("TokenMonitor save failed:", err);
//     }
//   }

//   async record({
//     promptTokens = 0,
//     completionTokens = 0,
//     totalTokens,
//   }: {
//     promptTokens?: number;
//     completionTokens?: number;
//     totalTokens?: number;
//   }) {
//     await this.init();

//     const total = totalTokens ?? promptTokens + completionTokens;

//     this.stats.totalPromptTokens += promptTokens;
//     this.stats.totalCompletionTokens += completionTokens;
//     this.stats.totalTokens += total;
//     this.stats.totalRequests++;

//     const avgTokens = this.stats.totalTokens / this.stats.totalRequests;

//     await this.persist();

//     console.log("AI TOKEN MONITOR");
//     console.log("----------------------------");
//     console.log("Request #:", this.stats.totalRequests);
//     console.log("Prompt Tokens:", promptTokens);
//     console.log("Completion Tokens:", completionTokens);
//     console.log("Total Tokens:", total);
//     console.log("Avg Tokens / Request:", avgTokens.toFixed(2));
//     console.log("Total Tokens Used:", this.stats.totalTokens);
//     console.log("----------------------------");
//   }

//   async getStats() {
//     await this.init();
//     return this.stats;
//   }

//   async reset() {
//     this.stats = {
//       totalPromptTokens: 0,
//       totalCompletionTokens: 0,
//       totalTokens: 0,
//       totalRequests: 0,
//     };

//     await AsyncStorage.removeItem(STORAGE_KEY);
//   }
// }

// export const tokenMonitor = new TokenMonitor();

// export const recordGeminiUsage = (response: any) => {
//   const usage = response?.usageMetadata;

//   if (!usage) return;

//   tokenMonitor.record({
//     promptTokens: usage.promptTokenCount,
//     completionTokens: usage.candidatesTokenCount,
//     totalTokens: usage.totalTokenCount,
//   });
// };