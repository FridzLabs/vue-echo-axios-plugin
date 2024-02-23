// Import types for Vue to define the plugin install function type.
import type { App } from "vue";
import Echo from "laravel-echo";
import Pusher from "pusher-js";
import type { AxiosError } from "axios";
import axios from "axios"; // Import Axios and AxiosError for error handling
import { useUserStore } from "/@/stores/user";

declare global {
  interface Window {
    Pusher: typeof Pusher; // Use the Pusher class type instead of any
  }
}

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $echo: Echo;
  }
}

window.Pusher = Pusher;

// Setup axios interceptors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Sign out the user on error
    useUserStore().signOut();
    return Promise.reject(error);
  }
);

// Define the interface for the plugin options to ensure type safety
interface PluginOptions {
  broadcaster: string;
  key: string;
  cluster: string;
  forceTLS: boolean;
  disableStats: boolean;
  encrypted: boolean;
  authEndpoint: string;
  token: string;
  referrer: string;
}

interface AuthorizeOptions {
  socketId: string;
  channelName: string;
}

interface AuthData {
  accessToken: string;
  tokenType: string;
}

interface ErrorType extends Error {
  statusCode?: number;
  message: string;
}

// Define the plugin install function with proper types
export default {
  install: (app: App, pluginOptions: PluginOptions): void => {
    const echo = new Echo({
      broadcaster: pluginOptions.broadcaster,
      key: pluginOptions.key,
      cluster: pluginOptions.cluster,
      forceTLS: pluginOptions.forceTLS,
      disableStats: pluginOptions.disableStats,
      encrypted: pluginOptions.encrypted,
      // Use the authorizer function to integrate custom authorization logic
      authorizer: (channel: { name: string }, _options: AuthorizeOptions) => ({
        authorize: async (
          socketId: string,
          callback: (error: ErrorType | null, authData?: AuthData) => void
        ) => {
          try {
            const response = await axios.post(
              pluginOptions.authEndpoint,
              {
                socket_id: socketId,
                channel_name: channel.name,
              },
              {
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${pluginOptions.token}`,
                  Accept: "application/json",
                  Referrer: pluginOptions.referrer,
                },
              }
            );
            callback(null, response.data);
          } catch (error: unknown) {
            const axiosError = error as AxiosError; // Type assertion

            const typedError: ErrorType = {
              name: "AxiosError", // Provide a name for the error, matching the ErrorType requirement
              message: axiosError.message || "Unknown error",
              statusCode: axiosError.response?.status, // Safely access the status code
            };

            callback(typedError);
          }
        },
      }),
    });

    app.config.globalProperties.$echo = echo;
  },
};
