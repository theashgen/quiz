package main

import "testing"

func TestLoopbackAddress(testRunner *testing.T) {
    for _, test := range []struct {
        address string
        allowed bool
    }{

        {
            "127.0.0.1:8443",
            true,
        },

        {
            "127.0.0.2:8443",
            true,
        },

        {
            "[::1]:8443",
            true,
        },

        {
            ":8443",
            false,
        },

        {
            "0.0.0.0:8443",
            false,
        },

        {
            "[::]:8443",
            false,
        },

        {
            "192.168.1.2:8443",
            false,
        },

        {
            "example.com:8443",
            false,
        },

        {
            "invalid",
            false,
        },
    } {
        testRunner.Run(test.address, func(testRunner *testing.T) {
            if allowed := loopbackAddress(test.address); allowed != test.allowed {
                testRunner.Fatalf("loopbackAddress(%q) = %v, want %v", test.address, allowed, test.allowed)
            }
        })
    }
}
