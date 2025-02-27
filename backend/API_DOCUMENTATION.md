# API Documentation

This document provides detailed information about the API endpoints available in the Factif AI backend.

## Action Routes

### POST /execute
- **Description**: Executes an action.
- **Request Body**: 
  ```json
  {
    "action": "string", // Description of the action to execute
    "parameters": {} // Parameters required for the action
  }
  ```
- **Response**: 
  ```json
  {
    "status": "success", // Status of the action execution
    "result": {} // Result of the executed action
  }
  ```
- **Example**:
  - **Request**:
    ```json
    {
      "action": "runTest",
      "parameters": {
        "testId": "12345"
      }
    }
    ```
  - **Response**:
    ```json
    {
      "status": "success",
      "result": {
        "message": "Test executed successfully."
      }
    }
    ```

## Chat Routes

### LLM Service Calls
When a chat API call is made, the following API calls are made to the LLM services:
- The `processMessage` method in the `ChatService` class is responsible for interacting with the LLM providers.
- Depending on the configuration, it can call different providers such as OpenAI, Anthropic, or Gemini.
- The method streams the response from the selected LLM provider based on the user's message and chat history.

### GET /health
- **Description**: Health check for the API.
- **Response**: 
  ```json
  {
    "status": "healthy" // Indicates the health status of the API
  }
  ```
- **Example**:
  - **Response**:
    ```json
    {
      "status": "healthy"
    }
    ```

### POST /chat
- **Description**: Processes chat messages.
- **Request Body**: 
  ```json
  {
    "message": "string" // The chat message to be processed
  }
  ```
- **Response**: 
  ```json
  {
    "response": "string" // The response generated from the chat message
  }
  ```
- **Example**:
  - **Request**:
    ```json
    {
      "message": "Hello, how can I help you?"
    }
    ```
  - **Response**:
    ```json
    {
      "response": "How can I assist you today?"
    }
    ```

### POST /download/testcases
- **Description**: Downloads test case files.
- **Response**: 
  ```json
  {
    "status": "success", // Status of the download
    "file": "string" // URL or path to the downloaded file
  }
  ```
- **Example**:
  - **Response**:
    ```json
    {
      "status": "success",
      "file": "/path/to/testcase.zip"
    }
    ```

## File System Routes

### GET /structure
- **Description**: Retrieves the file structure of the system.
- **Response**: 
  ```json
  {
    "structure": [] // Array representing the file structure
  }
  ```
- **Example**:
  - **Response**:
    ```json
    {
      "structure": [
        {
          "name": "folder1",
          "type": "directory"
        },
        {
          "name": "file1.txt",
          "type": "file"
        }
      ]
    }
    ```

This documentation provides a comprehensive overview of the API endpoints, their purposes, and examples of requests and responses.
