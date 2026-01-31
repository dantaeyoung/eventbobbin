<?php

$LOCAL_REPO = __DIR__;
$BRANCH = "main";

// Handle both form-encoded and JSON payloads from GitHub
$payload = $_POST['payload'] ?? file_get_contents('php://input');

if ($payload) {
    shell_exec("cd {$LOCAL_REPO} && git pull origin {$BRANCH} 2>&1");
    die("done " . time());
} else {
    echo "No payload received. This script expects a POST request from a git webhook.\n";
}

