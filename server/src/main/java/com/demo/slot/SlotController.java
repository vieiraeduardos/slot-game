package com.demo.slot;

import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@CrossOrigin
@RestController
public class SlotController {

    private final SlotService service;

    public SlotController(SlotService service) {
        this.service = service;
    }

    @GetMapping("/spin")
    public Map<String, int[]> spin() {

        int[] stops = service.spin();

        Map<String, int[]> res = new HashMap<>();
        res.put("stops", stops);

        return res;
    }

}