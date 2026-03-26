import { EventEmitter } from 'events';
import type { CaptureInterface, CaptureInterfaceOptions, Message, Region } from '@ffxiv-teamcraft/pcap-ffxiv';

const ACCEPTED_PACKETS: Message['type'][] = [
  'itemInfo',
  'containerInfo',
  'updateClassInfo',
  'playerSetup',
];

const SLOT_NAMES: Record<number, string> = {
  0: 'mainHand',
  1: 'offHand',
  2: 'head',
  3: 'chest',
  4: 'gloves',
  5: 'belt',
  6: 'legs',
  7: 'feet',
  8: 'earRings',
  9: 'necklace',
  10: 'bracelet',
  11: 'ring2',
  12: 'ring1',
  13: 'crystal',
};

export interface GearItem {
  itemId: number;
  slot: string;
  hq: boolean;
}

export interface GearSnapshot {
  characterId?: number;
  classId?: number;
  items: GearItem[];
  capturedAt: string;
}

export interface GearPacketCaptureEvents {
  started: () => void;
  stopped: () => void;
  error: (err: unknown) => void;
  gearSnapshot: (snapshot: GearSnapshot) => void;
}

export declare interface GearPacketCapture {
  on<K extends keyof GearPacketCaptureEvents>(event: K, listener: GearPacketCaptureEvents[K]): this;
  emit<K extends keyof GearPacketCaptureEvents>(event: K, ...args: Parameters<GearPacketCaptureEvents[K]>): boolean;
}

export class GearPacketCapture extends EventEmitter {
  private captureInterface: CaptureInterface | null = null;
  private pendingItems: Map<number, { itemId: number; hq: boolean }> = new Map();
  private currentClassId?: number;
  private currentCharacterId?: number;

  async start(region: Region = 'Global'): Promise<void> {
    const { CaptureInterface, ErrorCodes } = await import('@ffxiv-teamcraft/pcap-ffxiv');

    const debug = process.env['PCAP_DEBUG'] === '1';

    const options: Partial<CaptureInterfaceOptions> = {
      region,
      filter: (_header, typeName: Message['type']) => {
        if (debug) return true; // accept everything so we can see what arrives
        return ACCEPTED_PACKETS.includes(typeName);
      },
      logger: msg => console.log(`[pcap] [${msg.type ?? 'info'}] ${msg.message}`),
      name: 'ffxiv_gear_setup',
    };

    this.captureInterface = new CaptureInterface(options);
    this.captureInterface.setMaxListeners(0);

    this.captureInterface.on('message', (msg: Message) => {
      if (debug) {
        const opcode = (msg as Record<string, unknown>)['opcode'];
        const p = (msg as Record<string, unknown>)['parsedIpcData'] as Record<string, unknown> | undefined;
        console.log(`[pcap:debug] type=${msg.type} opcode=${opcode ?? '-'} containerId=${p?.['containerId'] ?? '-'} slot=${p?.['slot'] ?? '-'} catalogId=${p?.['catalogId'] ?? '-'}`);
      }
      this.handleMessage(msg);
    });
    this.captureInterface.on('error', err => this.emit('error', err));
    this.captureInterface.on('stopped', () => this.emit('stopped'));
    this.captureInterface.on('ready', () => {
      // Give 200ms for the named pipe to be created (matches Teamcraft behaviour)
      setTimeout(() => {
        this.captureInterface!
          .start()
          .then(() => {
            console.log('[pcap] Packet capture started');
            this.emit('started');
          })
          .catch((code: unknown) => {
            const message = typeof code === 'number' ? (ErrorCodes[code] ?? `Error code: ${code}`) : String(code);
            this.emit('error', new Error(message));
          });
      }, 200);
    });
  }

  async stop(): Promise<void> {
    if (this.captureInterface) {
      await this.captureInterface.stop();
      this.captureInterface = null;
    }
  }

  private handleMessage(msg: Message): void {
    const parsed = (msg as Record<string, unknown>)['parsedIpcData'] as Record<string, unknown> | undefined;
    if (!parsed) return;

    if (msg.type === 'updateClassInfo') {
      this.currentClassId = parsed['classId'] as number | undefined;
    }

    if (msg.type === 'playerSetup') {
      this.currentCharacterId = parsed['contentId'] as number | undefined;
    }

    if (msg.type === 'itemInfo' && parsed['containerId'] === 1000) {
      const slot = parsed['slot'] as number;
      this.pendingItems.set(slot, {
        itemId: parsed['catalogId'] as number,
        hq: parsed['hqFlag'] === true,
      });
    }

    if (msg.type === 'containerInfo' && parsed['containerId'] === 1000) {
      const items: GearItem[] = [];
      for (const [slot, item] of this.pendingItems) {
        if (item.itemId === 0) continue;
        items.push({
          slot: SLOT_NAMES[slot] ?? `slot_${slot}`,
          itemId: item.itemId,
          hq: item.hq,
        });
      }
      this.pendingItems.clear();

      if (items.length > 0) {
        const snapshot: GearSnapshot = {
          characterId: this.currentCharacterId,
          classId: this.currentClassId,
          items,
          capturedAt: new Date().toISOString(),
        };
        this.emit('gearSnapshot', snapshot);
      }
    }
  }
}
