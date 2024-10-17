# librechat-for-portkey

Librechat is an open source chat user interface for LLMs.

Portkey is a gateway for managing multiple LLMs (also called an LLM gateaway).

As it stands, Librechat can use Portkey as an endpoint to send requests to.
However, although Librechat can send request to Portkey, it is unable to send a unique identifier (ID, username, or email address) of the user to Porkey.
This feature is needed because many admins like myself would like to see metrics (especially cost metrics) at the user level.

Lucky for us, Librechat is open source. So I was able to edit bits of the source code to make this feature possible
Disclaimer, this has not been tested at a production level, and the logic of the Javascript code can definitely be improved.
This is meant to be a starting ground for how we can potentially refactor some of Librechat's back end to support this specific use case.


Now every request made to the Portkey endpoint/gateway is associated with the user that is making that request.
From Portkey's dashboard, it shows that timmanik@email.com made a request and spent X amount of cents in that request.

There are 4 files that need to be modified to make this work.  3 of which are config files and one is javascript code for the backend.

- Librechat/[`.env`](.env.example)
- Librechat/[`librechat.yaml`](librechat.example.yaml)
- Librechat/[`docker-compose.override.yml`](docker-compose.override.yml)
- Librechat/api/server/services/Endpoints/custom/[`initializeClient.js`](api/initializeClient.js)


Below I will add a couple notes about the additions/modifications that need to be made.

### [`.env`](.env.example)

Not much to explain here. Add the three Portkey variables listed in my file in addition to your other values within your existing .env file (or whever you host your secrets/params).

### [`librechat.yaml`](librechat.example.yaml)

You can leave your exising librechat.yaml code as is up until the **custom:** key (i.e. where you specify your custom endpoints). In here you would want to add an additional endpoint or modify your existing Portkey endpoint.

The most important part of this code for our use case is adding the header `x-portkey-metadata: '{"_user": "${USER_EMAIL}"}'`.

The variable ${USER_EMAIL} was one I created and it is referenced in the javascript code that processes the headers. I'm open to other naming conventions as well, but for now, this is the naming convention that our custom [`initializeClient.js`](api/initializeClient.js) code supports.

This will add `x-portkey-metadata` as a header to the request to Portkey and it will pass in the email address of the user making the request in Librechat so that we can see who made the request in Portkey.

### [`docker-compose.override.yml`](docker-compose.override.yml)

This specification tells docker compose to create the docker images to be built based off of the local files.

We need to build the images based on the local files because we are making changes to the backend (`initializeClient.js`).

Additionally, we still want to reference `librechat.yaml` so we do so via the following lines of code

```yaml
    volumes:
      - type: bind
        source: ./librechat.yaml
        target: /app/librechat.yaml
```

### [`initializeClient.js`](api/initializeClient.js)

The most important code we made modification to is `initializeClient.js`. Within the Librechat repository, this file is located in the following directory `/api/server/services/Endpoints/custom/`.

One of the functions of this file is to process the HTTP headers that gets passed to the endpoints Librechat is connected to.

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

As you can see, this is sort of a duct tape approach to getting our use case to work. The upside is that we are not changing much of Librechat.

What I think is a better direction to take is to either
1. Edit the header processing function in `initializeClient.js` to be more modular.
  - The current code is very hardcode-y and handles on the specific Portkey metadata header
2. Or create define the endpoint in `api/server/services/Endpoints/` just like ones already available for **Anthropic** or **Amazon Bedrock**