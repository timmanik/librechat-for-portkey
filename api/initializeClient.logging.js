const {
  CacheKeys,
  ErrorTypes,
  envVarRegex,
  EModelEndpoint,
  FetchTokenConfig,
  extractEnvVariable,
} = require('librechat-data-provider');
const { getUserKeyValues, checkUserKeyExpiry } = require('~/server/services/UserService');
const getCustomConfig = require('~/server/services/Config/getCustomConfig');
const { fetchModels } = require('~/server/services/ModelService');
const getLogStores = require('~/cache/getLogStores');
const { isUserProvided } = require('~/server/utils');
const { OpenAIClient } = require('~/app');
const User = require('~/models/User');    // FOR PORTKEY TESTING - model added to reference user information

const { PROXY } = process.env;

const initializeClient = async ({ req, res, endpointOption }) => {
  const { key: expiresAt, endpoint } = req.body;
  const customConfig = await getCustomConfig();
  if (!customConfig) {
    throw new Error(`Config not found for the ${endpoint} custom endpoint.`);
  }

  const { endpoints = {} } = customConfig;
  const customEndpoints = endpoints[EModelEndpoint.custom] ?? [];
  const endpointConfig = customEndpoints.find((endpointConfig) => endpointConfig.name === endpoint);

  const CUSTOM_API_KEY = extractEnvVariable(endpointConfig.apiKey);
  const CUSTOM_BASE_URL = extractEnvVariable(endpointConfig.baseURL);
  
  
  // ORIGINAL CODE FOR HEADER PROCESSING
  // let resolvedHeaders = {};
  // if (endpointConfig.headers && typeof endpointConfig.headers === 'object') {
  //   Object.keys(endpointConfig.headers).forEach((key) => {
  //     resolvedHeaders[key] = extractEnvVariable(endpointConfig.headers[key]);
  //   });
  // }


  // START OF PORTKEY TESTING CODEBLOCK FOR HEADER PROCESSING

  // Async function to replace ${userIdQuery} with the user's email
  const replaceUserIdQuery = async (metadata, userId) => {
    try {
      // Log the metadata before replacement for debugging
      console.log('Metadata before replacement:', metadata);

      // Fetch the user by ID from the database
      const user = await User.findById(userId).exec();
      
      // If the user is found, replace `${userIdQuery}` with their email
      if (user && user.email) {
        if (metadata.includes('${userIdQuery}')) {
          console.log('Replacing ${userIdQuery} with:', user.email);
          return metadata.replace('${userIdQuery}', user.email);
        } else {
          console.warn('Expected placeholder ${userIdQuery} not found in metadata:', metadata);
          return metadata;  // Return unchanged if no placeholder found
        }
      } else {
        throw new Error('User not found');
      }
    } catch (error) {
      console.error('Error fetching user email:', error);
      throw error;  // Pass the error along to be handled upstream
    }
  };

  let resolvedHeaders = {};
  if (endpointConfig.headers && typeof endpointConfig.headers === 'object') {
    await Promise.all(Object.keys(endpointConfig.headers).map(async (key) => {
      if (key === 'x-portkey-metadata') {
        try {
          // Custom processing for x-portkey-metadata, await the async function
          resolvedHeaders[key] = await replaceUserIdQuery(endpointConfig.headers[key], req.user.id);
        } catch (error) {
          console.error('Error in processing x-portkey-metadata:', error);
          resolvedHeaders[key] = 'null'; // Handle error by setting a fallback value
        }
      } else {
        // Process other headers normally
        resolvedHeaders[key] = extractEnvVariable(endpointConfig.headers[key]);
      }
    }));
  }
  // END OF PORTKEY TESTING CODEBLOCK FOR HEADER PROCESSING


  if (CUSTOM_API_KEY.match(envVarRegex)) {
    throw new Error(`Missing API Key for ${endpoint}.`);
  }

  if (CUSTOM_BASE_URL.match(envVarRegex)) {
    throw new Error(`Missing Base URL for ${endpoint}.`);
  }

  const userProvidesKey = isUserProvided(CUSTOM_API_KEY);
  const userProvidesURL = isUserProvided(CUSTOM_BASE_URL);

  let userValues = null;
  if (expiresAt && (userProvidesKey || userProvidesURL)) {
    checkUserKeyExpiry(expiresAt, endpoint);
    userValues = await getUserKeyValues({ userId: req.user.id, name: endpoint });
  }

  let apiKey = userProvidesKey ? userValues?.apiKey : CUSTOM_API_KEY;
  let baseURL = userProvidesURL ? userValues?.baseURL : CUSTOM_BASE_URL;

  if (userProvidesKey & !apiKey) {
    throw new Error(
      JSON.stringify({
        type: ErrorTypes.NO_USER_KEY,
      }),
    );
  }

  if (userProvidesURL && !baseURL) {
    throw new Error(
      JSON.stringify({
        type: ErrorTypes.NO_BASE_URL,
      }),
    );
  }

  if (!apiKey) {
    throw new Error(`${endpoint} API key not provided.`);
  }

  if (!baseURL) {
    throw new Error(`${endpoint} Base URL not provided.`);
  }

  const cache = getLogStores(CacheKeys.TOKEN_CONFIG);
  const tokenKey =
    !endpointConfig.tokenConfig && (userProvidesKey || userProvidesURL)
      ? `${endpoint}:${req.user.id}`
      : endpoint;

  let endpointTokenConfig =
    !endpointConfig.tokenConfig &&
    FetchTokenConfig[endpoint.toLowerCase()] &&
    (await cache.get(tokenKey));

  if (
    FetchTokenConfig[endpoint.toLowerCase()] &&
    endpointConfig &&
    endpointConfig.models.fetch &&
    !endpointTokenConfig
  ) {
    await fetchModels({ apiKey, baseURL, name: endpoint, user: req.user.id, tokenKey });
    endpointTokenConfig = await cache.get(tokenKey);
  }

  const customOptions = {
    headers: resolvedHeaders,
    addParams: endpointConfig.addParams,
    dropParams: endpointConfig.dropParams,
    titleConvo: endpointConfig.titleConvo,
    titleModel: endpointConfig.titleModel,
    forcePrompt: endpointConfig.forcePrompt,
    summaryModel: endpointConfig.summaryModel,
    modelDisplayLabel: endpointConfig.modelDisplayLabel,
    titleMethod: endpointConfig.titleMethod ?? 'completion',
    contextStrategy: endpointConfig.summarize ? 'summarize' : null,
    directEndpoint: endpointConfig.directEndpoint,
    titleMessageRole: endpointConfig.titleMessageRole,
    streamRate: endpointConfig.streamRate,
    endpointTokenConfig,
  };

  /** @type {undefined | TBaseEndpoint} */
  const allConfig = req.app.locals.all;
  if (allConfig) {
    customOptions.streamRate = allConfig.streamRate;
  }

  const clientOptions = {
    reverseProxyUrl: baseURL ?? null,
    proxy: PROXY ?? null,
    req,
    res,
    ...customOptions,
    ...endpointOption,
  };

  const client = new OpenAIClient(apiKey, clientOptions);
  return {
    client,
    openAIApiKey: apiKey,
  };
};

module.exports = initializeClient;
