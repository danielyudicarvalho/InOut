abstract final class ApiContract {
  static const apiVersion = '/api/v1';
  static const households = '$apiVersion/households';

  static String household(String householdId) => '$households/$householdId';

  static String ledger(String householdId) =>
      '${household(householdId)}/ledger';

  static String accounts(String householdId) =>
      '${ledger(householdId)}/accounts';
  static String balances(String householdId) =>
      '${ledger(householdId)}/balances';
  static String categories(String householdId) =>
      '${ledger(householdId)}/categories';
  static String expenses(String householdId) =>
      '${ledger(householdId)}/expenses';
  static String history(String householdId) => '${ledger(householdId)}/history';
  static String income(String householdId) => '${ledger(householdId)}/income';
  static String reconciliation(String householdId) =>
      '${ledger(householdId)}/reconciliation';
  static String transfers(String householdId) =>
      '${ledger(householdId)}/transfers';

  static String account(String householdId, String accountId) =>
      '${accounts(householdId)}/$accountId';

  static String reversals(String householdId, String transactionId) =>
      '${ledger(householdId)}/transactions/$transactionId/reversals';

  static String invitations(String householdId) =>
      '${household(householdId)}/invitations';

  static const acceptInvitation = '$apiVersion/household-invitations/accept';
}

abstract final class ApiMethods {
  static const delete = 'DELETE';
  static const get = 'GET';
  static const post = 'POST';
}

abstract final class ApiHeaders {
  static const accept = 'Accept';
  static const authorization = 'Authorization';
  static const bearer = 'Bearer';
  static const contentType = 'Content-Type';
  static const idempotencyKey = 'Idempotency-Key';
  static const json = 'application/json';
}

abstract final class ApiFields {
  static const account = 'account';
  static const accountId = 'accountId';
  static const accountName = 'accountName';
  static const amountCents = 'amountCents';
  static const archivedAt = 'archivedAt';
  static const balanceCents = 'balanceCents';
  static const balances = 'balances';
  static const categoryId = 'categoryId';
  static const code = 'code';
  static const createdBy = 'createdBy';
  static const currency = 'currency';
  static const description = 'description';
  static const destinationAccountId = 'destinationAccountId';
  static const direction = 'direction';
  static const entryTransactionCount = 'entryTransactionCount';
  static const flow = 'flow';
  static const id = 'id';
  static const initialBalanceCents = 'initialBalanceCents';
  static const isConsistent = 'isConsistent';
  static const kind = 'kind';
  static const name = 'name';
  static const occurredOn = 'occurredOn';
  static const openingDate = 'openingDate';
  static const postedAt = 'postedAt';
  static const postedTransactionCount = 'postedTransactionCount';
  static const replayed = 'replayed';
  static const reversalOf = 'reversalOf';
  static const sourceAccountId = 'sourceAccountId';
  static const status = 'status';
  static const transactionId = 'transactionId';
}

abstract final class ApiQueryFields {
  static const flow = 'flow';
  static const includeArchived = 'includeArchived';
  static const limit = 'limit';
}

abstract final class ApiErrorCodes {
  static const apiError = 'api_error';
  static const authenticationRequired = 'authentication_required';
  static const networkUnavailable = 'network_unavailable';
}

abstract final class ApiStatusCodes {
  static const networkUnavailable = 0;
  static const unauthorized = 401;
}
