import 'package:fieldops_mobile/app/theme/app_theme.dart';
import 'package:fieldops_mobile/app/widgets/skeleton_loader.dart';
import 'package:fieldops_mobile/features/budgeting/data/budget_repository_provider.dart';
import 'package:fieldops_mobile/features/budgeting/domain/budget_repository.dart';
import 'package:fieldops_mobile/features/budgeting/presentation/budget_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Screen showing budget vs actual for a specific job.
class JobBudgetScreen extends ConsumerWidget {
  const JobBudgetScreen({
    super.key,
    required this.jobId,
    required this.jobName,
  });

  final String jobId;
  final String jobName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final budgetAsync = ref.watch(_jobBudgetProvider(jobId));
    final textTheme = Theme.of(context).textTheme;
    final palette = context.palette;

    return Scaffold(
      appBar: AppBar(
        title: Text(jobName),
        leading: const BackButton(),
      ),
      body: budgetAsync.when(
        data: (budget) => SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              BudgetCard(budget: budget),
              const SizedBox(height: 24),
              _LaborBreakdownSection(
                budget: budget,
                palette: palette,
                textTheme: textTheme,
              ),
            ],
          ),
        ),
        loading: () => const Padding(
          padding: EdgeInsets.all(20),
          child: SkeletonLoader(itemCount: 3),
        ),
        error: (error, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.error_outline,
                size: 48,
                color: palette.danger,
              ),
              const SizedBox(height: 12),
              Text(
                'Failed to load budget',
                style: textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              Text(
                error.toString(),
                textAlign: TextAlign.center,
                style: textTheme.bodyMedium?.copyWith(color: palette.steel),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LaborBreakdownSection extends StatelessWidget {
  const _LaborBreakdownSection({
    required this.budget,
    required this.palette,
    required this.textTheme,
  });

  final JobBudgetSummary budget;
  final FieldOpsPalette palette;
  final TextTheme textTheme;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: palette.surfaceWhite,
        borderRadius: BorderRadius.circular(FieldOpsRadius.xxl),
        border: Border.all(color: palette.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Labor Breakdown', style: textTheme.titleMedium),
          const SizedBox(height: 16),
          _InfoRow(
            label: 'Hourly Rate',
            value: '\$${budget.hourlyRate.toStringAsFixed(2)}',
            palette: palette,
            textTheme: textTheme,
          ),
          const SizedBox(height: 8),
          _InfoRow(
            label: 'Budgeted Hours',
            value: '${budget.budgetedHours.toStringAsFixed(1)}h',
            palette: palette,
            textTheme: textTheme,
          ),
          const SizedBox(height: 8),
          _InfoRow(
            label: 'Actual Hours',
            value: '${budget.actualHours.toStringAsFixed(1)}h',
            valueColor: budget.isOverHours ? palette.danger : null,
            palette: palette,
            textTheme: textTheme,
          ),
          const SizedBox(height: 8),
          _InfoRow(
            label: 'Efficiency',
            value:
                '${budget.actualHours > 0 ? ((budget.budgetedHours / budget.actualHours) * 100).clamp(0, 999).toStringAsFixed(0) : 0}%',
            palette: palette,
            textTheme: textTheme,
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.label,
    required this.value,
    required this.palette,
    required this.textTheme,
    this.valueColor,
  });

  final String label;
  final String value;
  final FieldOpsPalette palette;
  final TextTheme textTheme;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: textTheme.bodyMedium?.copyWith(color: palette.steel),
        ),
        Text(
          value,
          style: textTheme.bodyLarge?.copyWith(
            fontWeight: FontWeight.w600,
            color: valueColor,
          ),
        ),
      ],
    );
  }
}

// Provider for job budget
final _jobBudgetProvider =
    FutureProvider.family<JobBudgetSummary, String>((ref, jobId) async {
  final repository = ref.watch(budgetRepositoryProvider);
  return repository.fetchJobBudget(jobId);
});
