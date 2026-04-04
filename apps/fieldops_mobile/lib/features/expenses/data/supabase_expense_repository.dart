import 'dart:io';

import 'package:fieldops_mobile/features/expenses/domain/expense_repository.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

class SupabaseExpenseRepository implements ExpenseRepository {
  const SupabaseExpenseRepository(this._client, {Uuid? uuid})
      : _uuid = uuid ?? const Uuid();

  final SupabaseClient _client;
  final Uuid _uuid;

  @override
  Future<String> submitExpense({
    required String jobId,
    required String category,
    required double amount,
    String? vendor,
    String? notes,
    String? mediaAssetId,
  }) async {
    try {
      final response = await _client.functions.invoke(
        'expenses',
        headers: {
          'Idempotency-Key': _uuid.v4(),
          'X-Client-Version': 'fieldops-mobile',
        },
        body: {
          'action': 'submit',
          'job_id': jobId,
          'category': category,
          'amount': amount,
          if (vendor != null) 'vendor': vendor,
          if (notes != null) 'notes': notes,
          if (mediaAssetId != null) 'media_asset_id': mediaAssetId,
        },
      );

      final payload = response.data;
      if (payload is! Map<String, dynamic>) {
        throw const ExpenseRepositoryException.unknown('Expense response malformed.');
      }

      return payload['expense_id'] as String? ?? '';
    } on SocketException {
      throw const ExpenseRepositoryException.offline();
    } on FunctionException catch (error) {
      if (error.status == 0) throw const ExpenseRepositoryException.offline();
      throw ExpenseRepositoryException.unknown('Expense failed (${error.status}).');
    }
  }
}
