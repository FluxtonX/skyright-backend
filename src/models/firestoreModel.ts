import admin from '../config/firebase';

type SortSpec = Record<string, 1 | -1>;
type QueryValue = any;
type QueryObject = Record<string, QueryValue>;

const db = admin.firestore();

const normalizeValue = (value: any): any => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  return value;
};

const matchesField = (actualRaw: any, expected: any): boolean => {
  const actual = normalizeValue(actualRaw);

  if (expected && typeof expected === 'object' && !(expected instanceof Date) && !Array.isArray(expected)) {
    if ('$in' in expected) {
      return expected.$in.map(normalizeValue).includes(actual);
    }

    if ('$regex' in expected) {
      const flags = expected.$options || '';
      return new RegExp(expected.$regex, flags).test(String(actual || ''));
    }

    if ('$ne' in expected) {
      return actual !== normalizeValue(expected.$ne);
    }
  }

  return actual === normalizeValue(expected);
};

const matchesQuery = (data: any, query: QueryObject): boolean => {
  return Object.entries(query).every(([key, expected]) => {
    if (key === '$or') {
      return expected.some((condition: QueryObject) => matchesQuery(data, condition));
    }

    return matchesField(data[key], expected);
  });
};

const compareValues = (a: any, b: any) => {
  const av = normalizeValue(a);
  const bv = normalizeValue(b);

  if (av === bv) return 0;
  if (av === undefined || av === null) return -1;
  if (bv === undefined || bv === null) return 1;
  return av > bv ? 1 : -1;
};

export class FirestoreDocument {
  [key: string]: any;

  constructor(
    private readonly collectionName: string,
    data: Record<string, any>
  ) {
    Object.assign(this, data);
  }

  toJSON() {
    const { collectionName, ...data } = this as any;
    return data;
  }

  async save() {
    this.updatedAt = new Date().toISOString();
    await db.collection(this.collectionName).doc(this._id).set(this.toJSON(), { merge: true });
    return this;
  }

  async deleteOne() {
    await db.collection(this.collectionName).doc(this._id).delete();
  }
}

class FirestoreQuery<T extends FirestoreDocument> implements PromiseLike<T[]> {
  private sortSpec?: SortSpec;
  private skipCount = 0;
  private limitCount?: number;
  private selectFields?: string[];

  constructor(
    private readonly collectionName: string,
    private readonly query: QueryObject,
    private readonly wrap: (data: Record<string, any>) => T
  ) {}

  sort(spec: SortSpec) {
    this.sortSpec = spec;
    return this;
  }

  skip(count: number) {
    this.skipCount = count;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  select(fields: string) {
    this.selectFields = fields.split(/\s+/).filter(Boolean);
    return this;
  }

  populate(..._args: any[]) {
    return this;
  }

  async exec(): Promise<T[]> {
    const snapshot = await db.collection(this.collectionName).get();
    let items = snapshot.docs
      .map((doc) => this.wrap({ _id: doc.id, id: doc.id, ...doc.data() }))
      .filter((item) => matchesQuery(item, this.query));

    if (this.sortSpec) {
      const [[field, direction]] = Object.entries(this.sortSpec);
      items = items.sort((a, b) => compareValues(a[field], b[field]) * direction);
    }

    if (this.skipCount) {
      items = items.slice(this.skipCount);
    }

    if (this.limitCount !== undefined) {
      items = items.slice(0, this.limitCount);
    }

    if (this.selectFields) {
      items = items.map((item) => {
        const selected: Record<string, any> = { _id: item._id, id: item.id };
        this.selectFields?.forEach((field) => {
          selected[field] = item[field];
        });
        return this.wrap(selected);
      });
    }

    return items;
  }

  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.exec().then(onfulfilled, onrejected);
  }
}

export const createFirestoreModel = <T extends FirestoreDocument = FirestoreDocument>(collectionName: string) => {
  const wrap = (data: Record<string, any>) => new FirestoreDocument(collectionName, data) as T;
  const collection = db.collection(collectionName);

  return class {
    static async create(data: Record<string, any>) {
      const now = new Date().toISOString();
      const docRef = collection.doc();
      const payload = {
        ...data,
        _id: docRef.id,
        id: docRef.id,
        createdAt: data.createdAt || now,
        updatedAt: data.updatedAt || now,
      };

      await docRef.set(payload);
      return wrap(payload);
    }

    static find(query: QueryObject = {}) {
      return new FirestoreQuery<T>(collectionName, query, wrap);
    }

    static async findOne(query: QueryObject = {}) {
      const [item] = await this.find(query).limit(1);
      return item || null;
    }

    static async findById(id: any) {
      const snapshot = await collection.doc(String(id)).get();
      if (!snapshot.exists) return null;
      return wrap({ _id: snapshot.id, id: snapshot.id, ...snapshot.data() });
    }

    static async countDocuments(query: QueryObject = {}) {
      const items = await this.find(query);
      return items.length;
    }

    static async deleteMany(query: QueryObject = {}) {
      const items = await this.find(query);
      const batch = db.batch();
      items.forEach((item) => batch.delete(collection.doc(item._id)));
      if (items.length) await batch.commit();
      return { deletedCount: items.length };
    }
  };
};
