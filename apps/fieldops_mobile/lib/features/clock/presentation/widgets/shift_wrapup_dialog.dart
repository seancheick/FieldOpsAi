import 'package:fieldops_mobile/app/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// Quick survey shown when worker clocks out.
/// Responses feed into daily shift reports.
class ShiftWrapupDialog extends StatefulWidget {
  const ShiftWrapupDialog({super.key, required this.jobName});

  final String jobName;

  static Future<ShiftWrapupData?> show(
    BuildContext context, {
    required String jobName,
  }) {
    return showModalBottomSheet<ShiftWrapupData>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => ShiftWrapupDialog(jobName: jobName),
    );
  }

  @override
  State<ShiftWrapupDialog> createState() => _ShiftWrapupDialogState();
}

class _ShiftWrapupDialogState extends State<ShiftWrapupDialog> {
  final _tasksController = TextEditingController();
  final _issuesController = TextEditingController();
  final _materialsController = TextEditingController();

  @override
  void dispose() {
    _tasksController.dispose();
    _issuesController.dispose();
    _materialsController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: palette.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text('Shift wrap-up', style: textTheme.titleLarge),
          Text(
            'Quick summary for ${widget.jobName}',
            style: textTheme.bodySmall,
          ),
          const SizedBox(height: 20),

          _buildField(context, 'What did you complete today?', _tasksController),
          const SizedBox(height: 12),
          _buildField(context, 'Any issues or blockers?', _issuesController),
          const SizedBox(height: 12),
          _buildField(context, 'Materials used?', _materialsController),
          const SizedBox(height: 20),

          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Skip'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(
                      context,
                      ShiftWrapupData(
                        tasksCompleted: _tasksController.text,
                        issues: _issuesController.text,
                        materialsUsed: _materialsController.text,
                      ),
                    );
                  },
                  child: const Text('Submit'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildField(
    BuildContext context,
    String label,
    TextEditingController controller,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: Theme.of(context).textTheme.labelMedium),
        const SizedBox(height: 4),
        TextFormField(
          controller: controller,
          maxLines: 2,
          decoration: InputDecoration(
            hintText: 'Optional',
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 10,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(FieldOpsRadius.md),
            ),
          ),
        ),
      ],
    );
  }
}

class ShiftWrapupData {
  const ShiftWrapupData({
    this.tasksCompleted = '',
    this.issues = '',
    this.materialsUsed = '',
  });

  final String tasksCompleted;
  final String issues;
  final String materialsUsed;

  bool get isEmpty =>
      tasksCompleted.isEmpty && issues.isEmpty && materialsUsed.isEmpty;
}
