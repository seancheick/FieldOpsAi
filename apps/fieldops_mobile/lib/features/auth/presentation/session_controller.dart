import 'package:fieldops_mobile/features/auth/data/auth_repository_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final sessionControllerProvider =
    NotifierProvider<SessionController, SessionState>(SessionController.new);

class SessionController extends Notifier<SessionState> {
  @override
  SessionState build() {
    final repository = ref.watch(authRepositoryProvider);
    return SessionState(
      isAuthenticated: repository.isAuthenticated,
      email: repository.currentUserEmail,
    );
  }

  void refresh() {
    final repository = ref.read(authRepositoryProvider);
    state = SessionState(
      isAuthenticated: repository.isAuthenticated,
      email: repository.currentUserEmail,
    );
  }

  Future<void> signOut() async {
    await ref.read(authRepositoryProvider).signOut();
    refresh();
  }
}

class SessionState {
  const SessionState({required this.isAuthenticated, this.email});

  final bool isAuthenticated;
  final String? email;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SessionState &&
          isAuthenticated == other.isAuthenticated &&
          email == other.email;

  @override
  int get hashCode => Object.hash(isAuthenticated, email);
}
