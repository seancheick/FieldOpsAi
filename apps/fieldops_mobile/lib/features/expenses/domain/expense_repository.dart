abstract class ExpenseRepository {
  Future<String> submitExpense({
    required String jobId,
    required String category,
    required double amount,
    String? vendor,
    String? notes,
    String? mediaAssetId,
  });
}

enum ExpenseCategory { materials, fuel, tools, meals, other }

enum ExpenseRepositoryErrorType { offline, unknown }

class ExpenseRepositoryException implements Exception {
  const ExpenseRepositoryException._({
    required this.type,
    required this.message,
  });

  const ExpenseRepositoryException.offline()
      : this._(
          type: ExpenseRepositoryErrorType.offline,
          message: 'No connection available.',
        );

  const ExpenseRepositoryException.unknown([
    String message = 'Expense could not be submitted.',
  ]) : this._(type: ExpenseRepositoryErrorType.unknown, message: message);

  final ExpenseRepositoryErrorType type;
  final String message;
}
