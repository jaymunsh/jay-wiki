'use client';

export const KAFKA_FAIL_OPTIONS = [
  { value: 'NONE', label: '정상 팬아웃' },
  { value: 'NOTIFICATION_RETRY', label: '알림 1회 재시도' },
  { value: 'NOTIFICATION_ALWAYS_FAIL', label: '알림 DLQ 전송' },
] as const;

export const KAFKA_CONSUMERS = [
  { name: 'inventory-consumer', label: 'Inventory projection' },
  { name: 'notification-consumer', label: 'Notification sender' },
  { name: 'analytics-consumer', label: 'Analytics projection' },
] as const;

export type KafkaFailMode = (typeof KAFKA_FAIL_OPTIONS)[number]['value'];

export type KafkaEventLog = {
  readonly stage: string;
  readonly status: string;
  readonly message: string;
  readonly createdAt: string;
};

export type KafkaConsumerResult = {
  readonly consumerName: string;
  readonly status: string;
  readonly attemptCount: number;
  readonly lastError: string | null;
  readonly updatedAt: string;
};

export type KafkaOrderView = {
  readonly orderId: string;
  readonly productCode: string;
  readonly quantity: number;
  readonly failMode: KafkaFailMode;
  readonly status: string;
  readonly createdAt: string;
  readonly kafka: {
    readonly enabled: boolean;
    readonly orderTopic: string;
    readonly dlqTopic: string;
  };
  readonly events: readonly KafkaEventLog[];
  readonly consumers: readonly KafkaConsumerResult[];
};

export function isKafkaTerminal(status: string): boolean {
  return status === 'COMPLETED' || status === 'FAILED';
}

export function statusTone(status: string): 'success' | 'danger' | 'warn' | 'idle' {
  switch (status) {
    case 'SUCCESS':
    case 'COMPLETED':
      return 'success';
    case 'FAILED':
    case 'RETRY':
    case 'RETRYING':
    case 'DLQ':
      return 'danger';
    case 'ACCEPTED':
    case 'PUBLISHED':
      return 'warn';
    default:
      return 'idle';
  }
}

export function parseKafkaOrder(value: unknown): KafkaOrderView | null {
  if (!isRecord(value)) return null;
  const orderId = stringField(value, 'orderId');
  const productCode = stringField(value, 'productCode');
  const quantity = numberField(value, 'quantity');
  const failMode = parseFailMode(stringField(value, 'failMode'));
  const status = stringField(value, 'status');
  const createdAt = stringField(value, 'createdAt');
  const kafka = parseKafkaState(value.kafka);
  const eventsValue = value.events;
  const consumersValue = value.consumers;
  if (!orderId || !productCode || quantity === null || !failMode || !status || !createdAt || !kafka) return null;
  if (!Array.isArray(eventsValue) || !Array.isArray(consumersValue)) return null;
  return {
    orderId,
    productCode,
    quantity,
    failMode,
    status,
    createdAt,
    kafka,
    events: eventsValue.map(parseEvent).filter((event): event is KafkaEventLog => event !== null),
    consumers: consumersValue
      .map(parseConsumer)
      .filter((consumer): consumer is KafkaConsumerResult => consumer !== null),
  };
}

export function parseKafkaOrders(value: unknown): readonly KafkaOrderView[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseKafkaOrder).filter((item): item is KafkaOrderView => item !== null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(value: Record<string, unknown>, key: string): string | null {
  const found = value[key];
  return typeof found === 'string' ? found : null;
}

function numberField(value: Record<string, unknown>, key: string): number | null {
  const found = value[key];
  return typeof found === 'number' ? found : null;
}

function booleanField(value: Record<string, unknown>, key: string): boolean | null {
  const found = value[key];
  return typeof found === 'boolean' ? found : null;
}

function parseFailMode(value: string | null): KafkaFailMode | null {
  switch (value) {
    case 'NONE':
    case 'NOTIFICATION_RETRY':
    case 'NOTIFICATION_ALWAYS_FAIL':
      return value;
    default:
      return null;
  }
}

function parseKafkaState(value: unknown): KafkaOrderView['kafka'] | null {
  if (!isRecord(value)) return null;
  const enabled = booleanField(value, 'enabled');
  const orderTopic = stringField(value, 'orderTopic');
  const dlqTopic = stringField(value, 'dlqTopic');
  if (enabled === null || !orderTopic || !dlqTopic) return null;
  return { enabled, orderTopic, dlqTopic };
}

function parseEvent(value: unknown): KafkaEventLog | null {
  if (!isRecord(value)) return null;
  const stage = stringField(value, 'stage');
  const status = stringField(value, 'status');
  const message = stringField(value, 'message');
  const createdAt = stringField(value, 'createdAt');
  if (!stage || !status || !message || !createdAt) return null;
  return { stage, status, message, createdAt };
}

function parseConsumer(value: unknown): KafkaConsumerResult | null {
  if (!isRecord(value)) return null;
  const consumerName = stringField(value, 'consumerName');
  const status = stringField(value, 'status');
  const attemptCount = numberField(value, 'attemptCount');
  const lastErrorValue = value.lastError;
  const updatedAt = stringField(value, 'updatedAt');
  const lastError = typeof lastErrorValue === 'string' ? lastErrorValue : null;
  if (!consumerName || !status || attemptCount === null || !updatedAt) return null;
  return { consumerName, status, attemptCount, lastError, updatedAt };
}
