/**
 * Creates a lightweight, controllable mock Supabase client for repository unit tests.
 * Tracks calls and query configurations without connecting to any real database.
 *
 * @param {Object} options
 * @param {any} [options.data=null] - Data to return on successful operations
 * @param {Object|null} [options.error=null] - Error object to return ({ message, code })
 * @returns {Object} Mock client with query-builder chain and spy records
 */
export function createMockSupabaseClient({ data = null, error = null } = {}) {
  const calls = {
    tables: [],
    inserts: [],
    updates: [],
    deletes: 0,
    selects: [],
    eqFilters: [],
    ranges: [],
    orderCalls: [],
    singleCalls: 0,
  };

  const client = {
    calls,
    from(tableName) {
      calls.tables.push(tableName);

      const queryBuilder = {
        insert(payload) {
          calls.inserts.push(payload);
          return queryBuilder;
        },
        update(payload) {
          calls.updates.push(payload);
          return queryBuilder;
        },
        delete() {
          calls.deletes += 1;
          return queryBuilder;
        },
        select(columns) {
          calls.selects.push(columns);
          return queryBuilder;
        },
        eq(column, value) {
          calls.eqFilters.push({ column, value });
          return queryBuilder;
        },
        range(from, to) {
          calls.ranges.push({ from, to });
          return queryBuilder;
        },
        order(column, options) {
          calls.orderCalls.push({ column, options });
          return queryBuilder;
        },
        single() {
          calls.singleCalls += 1;
          return Promise.resolve({ data, error });
        },
        then(onFulfilled, onRejected) {
          return Promise.resolve({ data, error }).then(onFulfilled, onRejected);
        },
      };

      return queryBuilder;
    },
  };

  return client;
}
