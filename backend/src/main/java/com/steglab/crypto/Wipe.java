package com.steglab.crypto;

import java.util.Arrays;

/**
 * Best-effort secret hygiene: every char[] password and byte[] key in the
 * codebase is overwritten as soon as it has served its purpose.
 */
public final class Wipe {

    private Wipe() {
    }

    public static void bytes(byte[]... arrays) {
        for (byte[] a : arrays) {
            if (a != null) Arrays.fill(a, (byte) 0);
        }
    }

    public static void chars(char[]... arrays) {
        for (char[] a : arrays) {
            if (a != null) Arrays.fill(a, '\0');
        }
    }
}
