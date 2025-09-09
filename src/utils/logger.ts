/**
 * Simple logger utility for the application
 */
export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== "test") {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },
  
  info: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== "test") {
      console.info(`[INFO] ${message}`, ...args);
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== "test") {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
  
  error: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== "test") {
      console.error(`[ERROR] ${message}`, ...args);
    }
  },
};