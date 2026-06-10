

/* export const executeWithRetry = async (nodeResult: any, attempt = 1): Promise<any> => {
    try {
        // 1. Validate
        nodeResult.calls.forEach(call => validateCall(call.name, call.args));
        return nodeResult; // Success!
    } catch (error) {
        if (attempt >= 3) throw error; // Max retries exceeded

        // 2. The Healer: Feed error back to LLM
        console.warn(`[DAG] Validation failed: ${error.message}. Retrying...`);

        const correctionPrompt = `The previous tool call failed validation: ${error.message}. Please fix the arguments and retry the call.`;

        // Inject correction into state and re-invoke Executor
        return await reInvokeExecutorWithCorrection(correctionPrompt);
    }
}; */