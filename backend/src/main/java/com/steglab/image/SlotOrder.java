package com.steglab.image;

import java.util.HashMap;
import java.util.Map;

/**
 * Produces the order in which eligible channel slots carry payload bits.
 *
 * Sequential: raster order. Scattered: a password-seeded permutation
 * generated with a sparse Fisher-Yates shuffle, so only the slots that
 * are actually used cost memory — O(k), not O(image).
 *
 * The PRNG is a self-contained xorshift64*, fixed here forever, so a
 * file embedded today extracts correctly on any future JVM.
 */
public final class SlotOrder {

    private final int universe;      // number of eligible slots
    private final boolean scattered;
    private long state;              // xorshift64* state
    private int drawn;               // how many indices handed out
    private final Map<Integer, Integer> swaps; // sparse Fisher-Yates memory

    public SlotOrder(int universe, boolean scattered, long seed) {
        this.universe = universe;
        this.scattered = scattered;
        this.state = seed == 0 ? 0x9E3779B97F4A7C15L : seed;
        this.swaps = scattered ? new HashMap<>() : null;
    }

    /** Index (0-based within the eligible universe) of the next slot. */
    public int next() {
        if (!scattered) {
            return drawn++;
        }
        int i = drawn++;
        int j = i + nextInt(universe - i);
        int valueAtJ = swaps.getOrDefault(j, j);
        int valueAtI = swaps.getOrDefault(i, i);
        swaps.put(j, valueAtI);
        swaps.remove(i); // never visited again; free the entry
        return valueAtJ;
    }

    public int remaining() {
        return universe - drawn;
    }

    private long nextLong() {
        long x = state;
        x ^= x >>> 12;
        x ^= x << 25;
        x ^= x >>> 27;
        state = x;
        return x * 0x2545F4914F6CDD1DL;
    }

    /** Uniform value in [0, bound) using rejection sampling. */
    private int nextInt(int bound) {
        if (bound <= 1) return 0;
        long mask = Long.MAX_VALUE;
        long limit = (mask / bound) * bound;
        long value;
        do {
            value = nextLong() & mask;
        } while (value >= limit);
        return (int) (value % bound);
    }
}
