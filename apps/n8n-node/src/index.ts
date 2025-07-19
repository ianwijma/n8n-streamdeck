import { StreamDeckTrigger } from './nodes/StreamDeckTrigger/StreamDeckTrigger.node';
import { StreamDeckApi } from './credentials/StreamDeckApi.credentials';

export { StreamDeckTrigger, StreamDeckApi };

export const nodes = [StreamDeckTrigger];

export const credentials = [StreamDeckApi];
