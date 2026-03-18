package com.demo.slot;

import org.springframework.stereotype.Service;

import java.util.Random;

@Service
public class SlotService {

    private final Random random = new Random();

    private final String[][] reels = {
            {"cherry","lemon","star","cherry","seven","star","lemon","cherry"},
            {"lemon","cherry","star","cherry","seven","star","cherry","lemon"},
            {"star","cherry","lemon","star","seven","cherry","lemon","star"}
    };

    public int[] spin() {

        int[] stops = new int[reels.length];

        for (int i = 0; i < reels.length; i++) {
            stops[i] = random.nextInt(reels[i].length);
        }

        return stops;
    }

    public String getSymbol(int reel, int index) {

        String[] strip = reels[reel];

        int pos = ((index % strip.length) + strip.length) % strip.length;

        return strip[pos];
    }

}