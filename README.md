# librechat-for-portkey

LibreChat is an open source chat user interface for LLMs.

Portkey is a gateway for managing multiple LLMs (also called an LLM gateway).

Currently, LibreChat can use Portkey as an endpoint to send requests. However, LibreChat is unable to send a unique identifier (ID, username, or email address) of the user to Portkey. This feature is needed because many admins, including myself, would like to see metrics (especially cost metrics) at the user level.

Fortunately, LibreChat is open source, allowing me to edit parts of the source code to enable this feature. Please note that this has not been tested at a production level, and the logic of the JavaScript code can be improved. This is intended as a starting point for potentially refactoring some of LibreChat's backend to support this specific use case.

With these modifications, every request made to the Portkey endpoint/gateway is associated with the user making that request. Portkey's dashboard now shows that timmanik@email.com made a request and spent X amount of cents on that request.

Four files need to be modified to make this work:

- LibreChat/[`.env`](.env.example)
- LibreChat/[`librechat.yaml`](librechat.example.yaml)
- LibreChat/[`docker-compose.override.yml`](docker-compose.override.yml)
- LibreChat/api/server/services/Endpoints/custom/[`initializeClient.js`](api/initializeClient.js)

Below are notes about the additions/modifications that need to be made:

### [`.env`](.env.example)

Add the three Portkey variables listed in my file to your existing .env file (or wherever you host your secrets/params).

### [`librechat.yaml`](librechat.example.yaml)

Leave your existing librechat.yaml code as is up until the **custom:** key (i.e., where you specify your custom endpoints). Add an additional endpoint or modify your existing Portkey endpoint.

The most important part for our use case is adding the header `x-portkey-metadata: '{"_user": "${USER_EMAIL}"}'`.

The variable ${USER_EMAIL} was created and is referenced in the JavaScript code that processes the headers. This naming convention is currently supported by our custom [`initializeClient.js`](api/initializeClient.js) code.

This will add `x-portkey-metadata` as a header to the request to Portkey, passing in the email address of the user making the request in LibreChat.

### [`docker-compose.override.yml`](docker-compose.override.yml)

This specification tells docker compose to create docker images based on the local files.

We need to build the images from local files because we are making changes to the backend (`initializeClient.js`).

Additionally, we want to reference `librechat.yaml`, which we do with the following lines of code:

```yaml
    volumes:
      - type: bind
        source: ./librechat.yaml
        target: /app/librechat.yaml
```

### [`initializeClient.js`](api/initializeClient.js)

The most significant modifications were made to `initializeClient.js`. In the LibreChat repository, this file is located in `/api/server/services/Endpoints/custom/`.

One of the functions of this file is to process the HTTP headers passed to the endpoints LibreChat is connected to.

#### Original code for the header processing
```javascript
    let resolvedHeaders = {};
    if (endpointConfig.headers && typeof endpointConfig.headers === 'object') {
    Object.keys(endpointConfig.headers).forEach((key) => {
        resolvedHeaders[key] = extractEnvVariable(endpointConfig.headers[key]);
    });
    }
```

#### Updated code for header processing
```javascript
const User = require('~/models/User');    // Added to reference user information

    /**...
    */

// FOR PORTKEY TESTING CODEBLOCK FOR HEADER PROCESSING

  // Async function to replace ${USER_EMAIL} with the user's email
  const replaceUserEmail = async (metadata, userId) => {
    try {
      // Fetch the user by ID from the database
      const user = await User.findById(userId).exec();
      
      // If the user is found, replace `${USER_EMAIL}` with their email
      if (user && user.email) {
        if (metadata.includes('${USER_EMAIL}')) {
          return metadata.replace('${USER_EMAIL}', user.email);
        } else {
          return metadata;  // Return unchanged if no placeholder found
        }
      } else {
        throw new Error('User not found');
      }
    } catch (error) {
      throw error;  // Pass the error along to be handled upstream
    }
  };

  let resolvedHeaders = {};
  if (endpointConfig.headers && typeof endpointConfig.headers === 'object') {
    await Promise.all(Object.keys(endpointConfig.headers).map(async (key) => {
      if (key === 'x-portkey-metadata') {
        try {
          // Custom processing for x-portkey-metadata, await the async function
          resolvedHeaders[key] = await replaceUserEmail(endpointConfig.headers[key], req.user.id);
        } catch (error) {
          resolvedHeaders[key] = 'null'; // Handle error by setting a fallback value
        }
      } else {
        // Process other headers normally
        resolvedHeaders[key] = extractEnvVariable(endpointConfig.headers[key]);
      }
    }));
  }
  // END OF PORTKEY TESTING CODEBLOCK FOR HEADER PROCESSING

    /**...
    */
```

You can copy the `initializeClient.js` file into the appropriate directory in your LibreChat repository. I also have another file in this repo called `initializeClient.logging.js`. It's basically the same thing, except it has logging.

As you can see, this is a somewhat improvised approach to getting our use case to work. The upside is that we are not changing much of LibreChat.

Better directions to consider are:

1. Edit the header processing function in `initializeClient.js` to be more modular.
   - The current code is quite specific and only handles the Portkey metadata header.
2. Or define the endpoint in `api/server/services/Endpoints/`, similar to those already available for **Anthropic** or **Amazon Bedrock**.