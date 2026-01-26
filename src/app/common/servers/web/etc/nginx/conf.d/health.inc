    location = /ping {
        return 200 pong;
    }

    location /health {
        location /health/ping {
            return 200 pong;
        }
        index index.html;
        try_files $uri $uri/ =404;
    }

