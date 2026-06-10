// A. Deterministic Stringifier
const deterministicStringify = (obj: any): string => {
    if (obj === null || typeof obj !== 'object') {
        return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
        return JSON.stringify(obj.map(deterministicStringify));
    }

    // Sort keys alphabetically to guarantee identical signatures
    const keys = Object.keys(obj).sort();
    const res: string[] = [];
    for (const key of keys) {
        res.push(`"${key}":${deterministicStringify(obj[key])}`);
    }
    return `{${res.join(',')}}`;
};

// B. robust deduplication helper using JSON stringification for deep comparison
export const mergeIdempotentCalls = (existingCalls: any[], newCalls: any[]): any[] => {
    const merged = [...existingCalls];

    for (const incomingCall of newCalls) {
        // Create a deterministic signature of the function call
        const signature = JSON.stringify({
            name: incomingCall.name,
            args: incomingCall.args // Note: Ensure object keys are sorted if args order varies
        });

        const isDuplicate = merged.some(existingCall =>
            deterministicStringify({ name: existingCall.name, args: existingCall.args }) === signature
        );

        if (!isDuplicate) {
            merged.push(incomingCall);
        } else {
            console.warn(`[DAG] Idempotency Shield: Dropped duplicate call for '${incomingCall.name}'`);
        }
    }

    return merged;
};