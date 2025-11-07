# LibreChat + Portkey User Identification - Now Native!

## Mission Accomplished

**This repository served its purpose!** What started as a proof-of-concept for passing user email addresses from LibreChat to Portkey has evolved into a **native feature in LibreChat**.

### The Journey

This repository was the birthplace of an idea that went through several stages:

1. **Initial Proof-of-Concept** (This repo) - Custom modifications to enable user identification
2. **[Pull Request #7934](https://github.com/danny-avila/LibreChat/pull/7934)** - First attempt at integration  
3. **[Collaborative Refinement](https://github.com/danny-avila/LibreChat/pull/7934#issuecomment-2980909272)** - Working with LibreChat founder Danny to improve the approach
4. **[Final Implementation #8030](https://github.com/danny-avila/LibreChat/pull/8030)** - Native feature that also fixed significant tech debt

The final implementation not only introduced user identification but also created a robust, modular system for dynamic headers that benefits the entire LibreChat ecosystem.

---

## Using the Native Feature

No more custom builds or modified containers! Here's how to use the native user identification feature:

### 1. Docker Compose Setup

Your `docker-compose.override.yml` is now much simpler:

```yaml
services:
  api:
    volumes:
    - type: bind
      source: ./librechat.yaml
      target: /app/librechat.yaml
```

### 2. LibreChat Configuration

In your `librechat.yaml`, you can now use dynamic user placeholders:

```yaml
endpoints:
  custom:
    - name: "Llama"
      apiKey: "dummy"
      baseURL: "https://api.portkey.ai/v1"
      headers:
        x-portkey-api-key: "${PORTKEY_API_KEY}"
        x-portkey-virtual-key: "${PORTKEY_VIRTUAL_KEY_AWS}"
        x-portkey-metadata: '{"_user": "{{LIBRECHAT_USER_EMAIL}}"}'
      models:
        default: ["meta.llama3-70b-instruct-v1:0"]
        fetch: false
      titleConvo: true
      titleModel: "current_model"
      summarize: false
      summaryModel: "current_model"
      forcePrompt: false
      modelDisplayLabel: "Llama"
      iconURL: https://images.crunchbase.com/image/upload/c_pad,f_auto,q_auto:eco,dpr_1/rjqy7ghvjoiu4cd1xjbf
```

### 3. Available User Placeholders

The native feature supports many more user fields than our original proof-of-concept. Below are examples of a few of them:

| Placeholder | User Field | Type | Description |
|------------|------------|------|-------------|
| `{{LIBRECHAT_USER_NAME}}` | name | String | User's display name |
| `{{LIBRECHAT_USER_USERNAME}}` | username | String | User's username |
| `{{LIBRECHAT_USER_EMAIL}}` | email | String | User's email address |
| `{{LIBRECHAT_USER_PROVIDER}}` | provider | String | Auth provider (e.g., "email", "google", "github") |
| `{{LIBRECHAT_USER_ROLE}}` | role | String | User's role (e.g., "user", "admin") |
| `{{LIBRECHAT_USER_GOOGLEID}}` | googleId | String | Google account ID |

For complete documentation on the full list, visit:
**[LibreChat MCP Servers Headers Documentation](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/mcp_servers#headers)**

### 4. Visual Customization

The example above demonstrates how to customize the endpoint's appearance:

- **`name`**: Internal identifier
- **`modelDisplayLabel`**: Name shown in the UI  
- **`iconURL`**: Custom icon for the endpoint

---

## Historical Archive

The original proof-of-concept code and documentation remain in the [`archive/`](archive/) folder for reference. This shows the evolution from custom modifications to native integration.

### What This Repository Demonstrated

- User identification from LibreChat to Portkey
- Custom header processing for dynamic user data
- Docker container modifications for custom builds
- Backend JavaScript modifications for user data extraction

### Key Learnings That Influenced the Final Implementation

1. **Modularity**: The need for reusable header processing logic
2. **Security**: Proper handling of user data in headers
3. **Extensibility**: Support for multiple user fields and providers
4. **Maintainability**: Avoiding hardcoded solutions

---

## Acknowledgments

This feature became reality through collaboration with the LibreChat community, especially:
- The **LibreChat contributors** who reviewed and improved the implementation
- The **Portkey team** for providing an excellent LLM gateway that benefits from user-level analytics

---

## Related Links

- [LibreChat Repository](https://github.com/danny-avila/LibreChat)
- [Original PR #7934](https://github.com/danny-avila/LibreChat/pull/7934)
- [Final Implementation PR #8030](https://github.com/danny-avila/LibreChat/pull/8030)
- [LibreChat Documentation](https://www.librechat.ai/docs)
- [Portkey Documentation](https://portkey.ai/docs)