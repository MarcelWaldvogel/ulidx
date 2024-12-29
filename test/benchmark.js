import Benchmark from "benchmark";
import { ulid } from "../dist/node/index.js";

export function detectPRNG(root) {
    const rootLookup = root || detectRoot();
    const globalCrypto =
        (rootLookup && (rootLookup.crypto || rootLookup.msCrypto)) ||
        (typeof crypto !== "undefined" ? crypto : null);
    if (typeof globalCrypto?.getRandomValues === "function") {
        return len => {
            const buffer = new Uint8Array(len);
            globalCrypto.getRandomValues(buffer);
            return buffer;
        };
    } else if (typeof globalCrypto?.randomBytes === "function") {
        return len => globalCrypto.randomBytes(len);
    } else if (crypto?.randomBytes) {
        return len => crypto.randomBytes(len);
    }
    throw new Layerr(
        {
            info: {
                code: "PRNG_DETECT",
                ...ERROR_INFO
            }
        },
        "Failed to find a reliable PRNG"
    );
}
function inWebWorker() {
    // @ts-ignore
    return typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
}

function detectRoot() {
    if (inWebWorker()) return self;
    if (typeof window !== "undefined") {
        return window;
    }
    if (typeof global !== "undefined") {
        return global;
    }
    if (typeof globalThis !== "undefined") {
        return globalThis;
    }
    return null;
}

const prng = detectPRNG();
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ENCODING_LEN = 32;
const RANDOM_LEN = 16;
const fake_randomness = Uint8Array.from([..."Hello, world!?[]"].map(e => e.charCodeAt(0)));
console.error(fake_randomness);
function concatEnd(len) {
    let str = "";
    for (len--; len >= 0; len--) {
        str = str + ENCODING.charAt(fake_randomness[len] % 32);
    }
    //assert(str.length == len);
    return str;
}
function concatEnd2(len) {
    let str = "";
    fake_randomness.forEach(r => {
        str = str + ENCODING.charAt(r % 32);
    });
    //assert(str.length == len);
    return str;
}
function concatStart(len) {
    let str = "";
    for (len--; len >= 0; len--) {
        str = ENCODING.charAt(fake_randomness[len] % 32) + str;
    }
    //assert(str.length == len);
    return str;
}
function mapJoin(len) {
    let str = Array.from(fake_randomness)
        .map(r => ENCODING.charAt(r % 32))
        .join("");
    //assert(str.length == len);
    return str;
}

export function encodeRandom_1by1(len, prng) {
    let str = "";
    for (; len > 0; len--) {
        const rand = prng(1);
        str = ENCODING.charAt(rand[0] % ENCODING_LEN) + str;
    }
    return str;
}

export function encodeRandom_waste_randomness_loop_concat(len, prng) {
    const rand = prng(len);

    let str = "";
    for (len--; len >= 0; len--) {
        str = str + ENCODING.charAt(rand[len] % 32);
    }
    return str;
}
export function encodeRandom_more_computation(len, prng) {
    const rand = prng(Math.ceil((5 * len) / 8));

    let str = "";
    let randomBits = rand[0];
    let bufOffset = 1;
    let bits = 8;
    for (len--; len >= 0; len--) {
        str = str + ENCODING.charAt(randomBits % 32);
        if (bits >= 10) {
            randomBits >>= 5;
            bits -= 5;
        } else {
            randomBits |= rand[bufOffset++];
            bits += 3;
        }
    }
    return str;
}

console.error(concatStart(RANDOM_LEN));
console.error(concatEnd(RANDOM_LEN));
console.error(concatEnd2(RANDOM_LEN));
console.error(mapJoin(RANDOM_LEN));
console.error(encodeRandom_1by1(RANDOM_LEN, prng));
console.error(encodeRandom_waste_randomness_loop_concat(RANDOM_LEN, prng));
console.error(encodeRandom_more_computation(RANDOM_LEN, prng));

const suite = new Benchmark.Suite();

// add tests
suite.add("Simple ulid", function () {
    ulid();
});
suite.add("ulid with timestamp", function () {
    ulid(Date.now());
});
suite.add("string concatenation from front", function () {
    concatStart(RANDOM_LEN);
});
suite.add("string concatenation from back", function () {
    concatEnd(RANDOM_LEN);
});
suite.add("string concatenation from back with forEach", function () {
    concatEnd2(RANDOM_LEN);
});
suite.add("string concatenation by map/join", function () {
    mapJoin(RANDOM_LEN);
});
suite.add("randomness 1by1", function () {
    encodeRandom_1by1(RANDOM_LEN, prng);
});
suite.add("randomness wasteful bits", function () {
    encodeRandom_waste_randomness_loop_concat(RANDOM_LEN, prng);
});
suite.add("randomness more computation", function () {
    encodeRandom_more_computation(RANDOM_LEN, prng);
});

// add listeners
suite.on("cycle", function (event) {
    console.log(String(event.target));
});
suite.on("complete", function () {
    console.log("Done!");
});

// run async
suite.run({ async: true });
