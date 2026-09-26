import { defaultConfigPath, loadConfig } from "./config.ts";
import { createVoiceServer } from "./server.ts";
import { runTurn } from "./turn.ts";

const config = loadConfig(process.env.VTV_CONFIG ?? defaultConfigPath);
createVoiceServer(config, (req) => runTurn(req)).listen(config.port, config.host, () => {
  console.log(`voice-to-vibe server on http://${config.host}:${config.port}`);
});
