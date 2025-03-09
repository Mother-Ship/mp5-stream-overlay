package main

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

func main() {
	// Configure URLs and target path.
	urls := []string{
		"https://mp5tournament.github.io/bracket.json",
		"https://mp5tournament.pages.dev/bracket.json",
	}
	targetPath, err := filepath.Abs(filepath.Join(".", "static", "COMMON", "data", "bracket.json"))
	if err != nil {
		fmt.Println("错误：无法获取目标文件绝对路径:", err) // Error: Unable to get absolute path of target file
		time.Sleep(1 * time.Second)
		return
	}

	// Ensure TLS 1.2+
	http.DefaultTransport.(*http.Transport).TLSClientConfig = &tls.Config{MinVersion: tls.VersionTLS12}

	// Try downloading from multiple sources.
	success := false
	for _, url := range urls {
		fmt.Printf("\n正在尝试从以下地址下载: %s\n", url) // Trying to download from: %s

		err := downloadAndValidate(url, targetPath)
		if err == nil {
			success = true
			fmt.Println("下载并验证成功") // Download and validation successful
			break
		}
		fmt.Printf("下载失败: %v\n", err) // Download failed: %v
	}

	// Final result.
	if success {
		fmt.Printf("\n文件已更新: %s\n", targetPath) // File updated: %s
	} else {
		fmt.Println("\n所有源均不可用，保留原文件") // All sources are unavailable, keeping the original file
	}

	fmt.Println("\n1秒后自动关闭...") // Automatically close after 1 second...
	time.Sleep(1 * time.Second)
}

// downloadAndValidate downloads the file from the given URL, validates its content,
// and writes it to the target path.  It handles errors and retries.
func downloadAndValidate(url, targetPath string) error {
	// Create an HTTP client with a timeout.
	client := &http.Client{
		Timeout: 15 * time.Second,
		Transport: &http.Transport{ // Add Transport for TLS config
			TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS12},
		},
	}

	// Create the request.
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("创建请求失败: %w", err) // Failed to create request: %w
	}

	// Execute the request.
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("执行请求失败: %w", err) // Failed to execute request: %w
	}
	defer resp.Body.Close()

	// Check the response status code.
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP状态码错误: %d", resp.StatusCode) // HTTP status code error: %d
	}

	// Create target directory if it doesn't exist
	targetDir := filepath.Dir(targetPath)
	if _, err := os.Stat(targetDir); os.IsNotExist(err) {
		if err := os.MkdirAll(targetDir, 0755); err != nil {
			return fmt.Errorf("创建目录失败: %w", err) // Failed to create directory
		}
	}

	// Create the target file.  Create it *after* the download, so we don't
	// leave a partial file on failure.
	file, err := os.Create(targetPath)
	if err != nil {
		return fmt.Errorf("创建目标文件失败: %w", err) // Failed to create target file: %w
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil && err == nil {
			err = fmt.Errorf("关闭文件失败: %w", closeErr) // Failed to close file
		}
	}()

	// Copy the response body to the file.
	_, err = io.Copy(file, resp.Body)
	if err != nil {
		_ = os.Remove(targetPath)                  // Attempt to remove the file on copy failure.
		return fmt.Errorf("写入文件失败: %w", err) // Failed to write to file: %w
	}

	// Reset file offset to the beginning for validation.
	if _, err := file.Seek(0, 0); err != nil {
		return fmt.Errorf("重置文件偏移量失败: %w", err) // Failed to reset file offset
	}

	// Validate the JSON content.
	if err := isValidJSON(file); err != nil {
		_ = os.Remove(targetPath)                  // Attempt to remove file on invalid JSON
		return fmt.Errorf("JSON验证失败: %w", err) // JSON validation failed
	}

	return nil
}

// isValidJSON checks if the given reader contains valid JSON data and is not empty.
func isValidJSON(r io.ReadSeeker) error {
	// Check for empty file.  We need to do this *before* decoding,
	// because an empty file is technically valid (but useless) JSON.
	fi, err := r.Seek(0, io.SeekCurrent) // get current position
	if err != nil {
		return fmt.Errorf("获取文件当前位置失败: %w", err) // "Failed to get current file position"
	}
	if _, err := r.Seek(0, io.SeekStart); err != nil { // seek to start
		return fmt.Errorf("寻找文件开头失败: %w", err)
	}
	size, err := r.Seek(0, io.SeekEnd)
	if err != nil {
		return fmt.Errorf("寻找文件结尾失败: %w", err)
	}
	if _, err := r.Seek(fi, io.SeekStart); err != nil { // seek back to original position
		return fmt.Errorf("寻找文件原始位置失败: %w", err)
	}

	if size == 0 {
		return fmt.Errorf("文件为空") // File is empty
	}

	// Decode the JSON.
	var data interface{}
	decoder := json.NewDecoder(r)
	err = decoder.Decode(&data)
	if err != nil {
		return fmt.Errorf("JSON解码失败: %w", err) // JSON decoding failed: %w
	}

	return nil
}

