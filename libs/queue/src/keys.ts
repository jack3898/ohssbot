export const KEYS = {
    RECORD: 'RECORD'
} as const;

export type RecordJob = {
    executable: string;
    fileId: string;
    danserOptions: (`--settings=${string}` | `--quickstart`)[];
};

export type KeyType = (typeof KEYS)[keyof typeof KEYS];

export type KeysObject = typeof KEYS;