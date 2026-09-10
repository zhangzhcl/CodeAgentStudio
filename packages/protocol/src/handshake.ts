import { PROTOCOL_VERSION } from './index.js';
export type ProtocolHandshake = { protocolVersion: number; client: 'renderer' | 'main'; build: string };
export function validateHandshake(handshake: ProtocolHandshake) { if (handshake.protocolVersion !== PROTOCOL_VERSION) throw new Error(`Protocol version mismatch: ${handshake.protocolVersion} != ${PROTOCOL_VERSION}`); return true; }
