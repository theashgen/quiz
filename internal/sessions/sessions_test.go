package sessions

import (
    "net/http"
    "net/http/httptest"
    "testing"
)

func TestCookiePolicyRequiresExplicitLocalHTTP(testRunner *testing.T) {
    for _, test := range []struct {
        name   string
        local  bool
        cookie string
    }{

        {
            "secure default",
            false,
            CookieName,
        },

        {
            "explicit local HTTP",
            true,
            "quiz_guest_local",
        },
    } {
        testRunner.Run(test.name, func(testRunner *testing.T) {
            var handler http.Handler = http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
                if name := cookieName(request.Context()); name != test.cookie {
                    testRunner.Fatalf("cookie name %q, want %q", name, test.cookie)
                }
            })

            if test.local {
                handler = LocalHTTP(handler)
            }

            handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "http://localhost:8443", nil))
        })
    }
}
