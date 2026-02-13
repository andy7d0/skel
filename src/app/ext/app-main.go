package main

import (
	"fmt"
	"log"
	"net/http"
	"andy7d0/dummy/testing.x"
)

// handler is a function that takes an http.ResponseWriter and an http.Request.
func handler(w http.ResponseWriter, r *http.Request) {
	// fmt.Fprintf writes the response body to the http.ResponseWriter
	fmt.Fprintf(w, "Hi there, I love %s!", r.URL.Path[1:])
}

// handler is a function that takes an http.ResponseWriter and an http.Request.
func handlerTest(w http.ResponseWriter, r *http.Request) {
	// fmt.Fprintf writes the response body to the http.ResponseWriter
	fmt.Fprintf(w, "Hi there, I am test!")
}
func handlerTest2(w http.ResponseWriter, r *http.Request) {
	// fmt.Fprintf writes the response body to the http.ResponseWriter
	fmt.Fprintf(w, "Hi there, I  %d!", testing.X())
}

func main() {
	// Register the handler function for the "/" route
	http.HandleFunc("/", handler)
	http.HandleFunc("/app/ext/test", handlerTest)
	http.HandleFunc("/app/ext/test2", handlerTest2)

	// Start the server and listen on port XXXX on any interface
	fmt.Println("Server starting on port 9580...")
	// http.ListenAndServe blocks until the program is terminated or an error occurs
	err := http.ListenAndServe(":9580", nil)
	if err != nil {
		// Log the error if the server fails to start
		log.Fatal(err)
	}
}
