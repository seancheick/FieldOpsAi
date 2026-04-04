import 'dart:io';

import 'package:camera/camera.dart' as cam;
import 'package:fieldops_mobile/features/camera/data/media_repository_provider.dart';
import 'package:fieldops_mobile/features/camera/domain/media_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final captureControllerProvider =
    NotifierProvider<CaptureController, CaptureState>(CaptureController.new);

class CaptureController extends Notifier<CaptureState> {
  @override
  CaptureState build() => const CaptureIdle();

  Future<void> captureAndUpload({
    required String jobId,
    required cam.CameraController cameraController,
  }) async {
    state = const CaptureCapturing();

    try {
      final xFile = await cameraController.takePicture();
      final file = File(xFile.path);
      final fileBytes = await file.readAsBytes();
      final fileSizeBytes = fileBytes.length;

      state = const CaptureUploading();

      final repository = ref.read(mediaRepositoryProvider);

      final presign = await repository.presignUpload(
        jobId: jobId,
        mimeType: 'image/jpeg',
        fileSizeBytes: fileSizeBytes,
      );

      await repository.uploadFile(
        uploadUrl: presign.uploadUrl,
        fileBytes: fileBytes,
        mimeType: 'image/jpeg',
      );

      state = const CaptureFinalizing();

      await repository.finalizeUpload(mediaAssetId: presign.mediaAssetId);

      state = CaptureDone(mediaAssetId: presign.mediaAssetId);
    } on MediaRepositoryException catch (error) {
      state = CaptureError(message: error.message);
    } on cam.CameraException catch (error) {
      state = CaptureError(
        message: error.description ?? 'Camera capture failed.',
      );
    } on Exception catch (_) {
      state = const CaptureError(
        message: 'Photo capture could not be completed.',
      );
    }
  }

  void reset() {
    state = const CaptureIdle();
  }
}

sealed class CaptureState {
  const CaptureState();
}

class CaptureIdle extends CaptureState {
  const CaptureIdle();
}

class CaptureCapturing extends CaptureState {
  const CaptureCapturing();
}

class CaptureUploading extends CaptureState {
  const CaptureUploading();
}

class CaptureFinalizing extends CaptureState {
  const CaptureFinalizing();
}

class CaptureDone extends CaptureState {
  const CaptureDone({required this.mediaAssetId});
  final String mediaAssetId;
}

class CaptureError extends CaptureState {
  const CaptureError({required this.message});
  final String message;
}
