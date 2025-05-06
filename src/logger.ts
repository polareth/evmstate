import createDebug from "debug";

export const logger = {
  log: createDebug("trace"),
  error: createDebug("trace"),
};

// Pipe debug output to stdout instead of stderr
logger.log.log = console.debug.bind(console);

// Pipe error output to stderr
logger.error.log = console.error.bind(console);
