import 'dart:io';

import 'package:drift/drift.dart';
import 'package:fieldops_mobile/core/data/local_database.dart';
import 'package:fieldops_mobile/features/camera/data/media_repository_provider.dart';
import 'package:fieldops_mobile/features/camera/domain/media_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

class PhotoDraftRepository {
  PhotoDraftRepository({
    required LocalDatabase database,
    required MediaRepository mediaRepository,
    Uuid? uuid,
  }) : _database = database,
       _mediaRepository = mediaRepository,
       _uuid = uuid ?? const Uuid();

  final LocalDatabase _database;
  final MediaRepository _mediaRepository;
  final Uuid _uuid;

  Stream<List<PendingMediaUpload>> watchDraftsForJob(String jobId) {
    return _database.watchPendingMediaUploadsForJob(jobId);
  }

  Future<int> draftCount({String? jobId}) {
    return _database.pendingMediaUploadCount(jobId: jobId);
  }

  Future<String> saveDraft({
    required String jobId,
    required String filePath,
    String mimeType = 'image/jpeg',
  }) async {
    final draftId = _uuid.v4();
    await _database.savePendingMediaUpload(
      PendingMediaUploadsCompanion.insert(
        id: draftId,
        jobId: jobId,
        filePath: filePath,
        mimeType: Value(mimeType),
      ),
    );
    return draftId;
  }

  Future<void> deleteDraft(String draftId) async {
    final draft = await _database.findPendingMediaUpload(draftId);
    if (draft == null) return;

    await _database.deletePendingMediaUpload(draftId);

    final file = File(draft.filePath);
    if (await file.exists()) {
      await file.delete();
    }
  }

  Future<String> uploadDraft(String draftId) async {
    final draft = await _database.findPendingMediaUpload(draftId);
    if (draft == null) {
      throw const MediaRepositoryException.unknown(
        'Saved photo could not be found.',
      );
    }

    final file = File(draft.filePath);
    if (!await file.exists()) {
      await _database.deletePendingMediaUpload(draftId);
      throw const MediaRepositoryException.unknown(
        'Saved photo file is missing.',
      );
    }

    final fileBytes = await file.readAsBytes();

    try {
      final presign = await _mediaRepository.presignUpload(
        jobId: draft.jobId,
        mimeType: draft.mimeType,
        fileSizeBytes: fileBytes.length,
      );

      await _mediaRepository.uploadFile(
        uploadUrl: presign.uploadUrl,
        fileBytes: fileBytes,
        mimeType: draft.mimeType,
      );

      await _mediaRepository.finalizeUpload(mediaAssetId: presign.mediaAssetId);

      await _database.markPendingMediaUploadUploaded(draftId);
      await deleteDraft(draftId);
      return presign.mediaAssetId;
    } on MediaRepositoryException catch (error) {
      await _database.markPendingMediaUploadFailed(
        draftId,
        error.message,
        retryCount: draft.retryCount + 1,
      );
      rethrow;
    }
  }
}

final photoDraftRepositoryProvider = Provider<PhotoDraftRepository>((ref) {
  return PhotoDraftRepository(
    database: ref.watch(localDatabaseProvider),
    mediaRepository: ref.watch(mediaRepositoryProvider),
  );
});

final pendingPhotoDraftCountProvider = StreamProvider<int>((ref) {
  final repository = ref.watch(photoDraftRepositoryProvider);
  return Stream<int>.periodic(
    const Duration(seconds: 5),
  ).asyncMap((_) => repository.draftCount());
});

final pendingPhotoDraftCountForJobProvider = StreamProvider.family<int, String>(
  (ref, jobId) {
    final repository = ref.watch(photoDraftRepositoryProvider);
    return Stream<int>.periodic(
      const Duration(seconds: 5),
    ).asyncMap((_) => repository.draftCount(jobId: jobId));
  },
);

final photoDraftsForJobProvider =
    StreamProvider.family<List<PendingMediaUpload>, String>((ref, jobId) {
      return ref.watch(photoDraftRepositoryProvider).watchDraftsForJob(jobId);
    });
