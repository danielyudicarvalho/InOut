enum HouseholdSyncEvent { connecting, connected, changed, disconnected }

abstract interface class HouseholdSyncGateway {
  Stream<HouseholdSyncEvent> watch(String householdId);
}
