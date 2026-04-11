package com.edgecare.util

import android.content.Context
import android.graphics.Bitmap
import org.json.JSONObject
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.support.common.FileUtil
import org.tensorflow.lite.support.common.ops.NormalizeOp
import org.tensorflow.lite.support.image.ImageProcessor
import org.tensorflow.lite.support.image.TensorImage
import org.tensorflow.lite.support.image.ops.ResizeOp
import java.nio.MappedByteBuffer

class EdgeAiAnalyzer(private val context: Context) {

    private var interpreter: Interpreter? = null
    private val labels = listOf("mild", "moderate", "severe")

    init {
        try {
            val modelBuffer: MappedByteBuffer = FileUtil.loadMappedFile(context, "ml/skin_model.tflite")
            interpreter = Interpreter(modelBuffer)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun analyze(bitmap: Bitmap): JSONObject? {
        val tflite = interpreter ?: return null

        try {
            // 1. Preprocess: Resize 224x224 and Normalize 1/255.0
            val imageProcessor = ImageProcessor.Builder()
                .add(ResizeOp(224, 224, ResizeOp.ResizeMethod.BILINEAR))
                .add(NormalizeOp(0f, 255f)) // Rescale to 0..1
                .build()

            var tensorImage = TensorImage(org.tensorflow.lite.DataType.FLOAT32)
            tensorImage.load(bitmap)
            tensorImage = imageProcessor.process(tensorImage)

            // 2. Run Inference
            val outputBuffer = Array(1) { FloatArray(3) }
            tflite.run(tensorImage.buffer, outputBuffer)

            // 3. Map results
            val scores = outputBuffer[0]
            val mildScore = scores[0]
            val moderateScore = scores[1]
            val severeScore = scores[2]

            val maxIndex = scores.indices.maxByOrNull { scores[it] } ?: 0
            val predictedClass = labels[maxIndex]
            val confidence = scores[maxIndex]

            // 4. Build mlImageResult
            val result = JSONObject()
            result.put("predicted_class", predictedClass)
            result.put("confidence", confidence.toDouble())
            
            val scoresObj = JSONObject()
            scoresObj.put("mild", mildScore.toDouble())
            scoresObj.put("moderate", moderateScore.toDouble())
            scoresObj.put("severe", severeScore.toDouble())
            result.put("scores", scoresObj)

            return result
        } catch (e: Exception) {
            e.printStackTrace()
            return null
        }
    }

    /**
     * Web logic (match exactly):
     * - if predicted_class contains "severe" => 1
     * - contains "moderate" => 0.5
     * - contains "mild" => 0
     * - else if confidence available in [0..1], return confidence
     * - else return 0.5
     */
    fun severityScoreFromImageResult(result: JSONObject?): Double {
        if (result == null) return 0.5
        
        val predictedClass = result.optString("predicted_class", "").lowercase()
        val confidence = result.optDouble("confidence", 0.5)

        return when {
            predictedClass.contains("severe") -> 1.0
            predictedClass.contains("moderate") -> 0.5
            predictedClass.contains("mild") -> 0.0
            !confidence.isNaN() -> confidence
            else -> 0.5
        }
    }
}
