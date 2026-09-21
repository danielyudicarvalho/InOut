import 'dart:async';

import 'package:inout/src/application/sync/household_sync_gateway.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final class SupabaseHouseholdSyncGateway implements HouseholdSyncGateway {
  SupabaseHouseholdSyncGateway(this._client);

  final SupabaseClient _client;

  @override
  Stream<HouseholdSyncEvent> watch(String householdId) {
    late final RealtimeChannel channel;
    late final StreamController<HouseholdSyncEvent> controller;
    controller = StreamController<HouseholdSyncEvent>(
      onListen: () {
        channel = _client
            .channel('household-sync:$householdId')
            .onPostgresChanges(
              event: PostgresChangeEvent.insert,
              schema: 'public',
              table: 'household_change_signals',
              filter: PostgresChangeFilter(
                type: PostgresChangeFilterType.eq,
                column: 'household_id',
                value: householdId,
              ),
              callback: (_) => controller.add(HouseholdSyncEvent.changed),
            )
            .subscribe((status, error) {
              if (status == RealtimeSubscribeStatus.subscribed) {
                controller.add(HouseholdSyncEvent.connected);
              } else if (status == RealtimeSubscribeStatus.channelError ||
                      status == RealtimeSubscribeStatus.timedOut ||
                      status == RealtimeSubscribeStatus.closed) {
                controller.add(HouseholdSyncEvent.disconnected);
              }
            });
      },
      onCancel: () async {
        await _client.removeChannel(channel);
      },
    );

    return controller.stream;
  }
}
