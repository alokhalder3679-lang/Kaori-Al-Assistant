package com.example.kaoriai

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.*
import java.util.concurrent.TimeUnit

data class Message(
    val id: String = UUID.randomUUID().toString(),
    val text: String,
    val isUser: Boolean,
    val timestamp: Long = System.currentTimeMillis()
)

enum class CoreAtmosphere(
    val displayName: String,
    val primaryColor: Color,
    val glowColor: Color,
    val secondaryColor: Color
) {
    SLATE("Slate", Color(0xFF64748B), Color(0xFF94A3B8), Color(0xFF1E293B)),
    VIOLET("Astral", Color(0xFF8B5CF6), Color(0xFFD8B4FE), Color(0xFF4C1D95)),
    CRIMSON("Crimson", Color(0xFFEF4444), Color(0xFFFCA5A5), Color(0xFF7F1D1D)),
    CYAN("Cyan", Color(0xFF06B6D4), Color(0xFF67E8F9), Color(0xFF083344)),
    GOLD("Amber", Color(0xFFF59E0B), Color(0xFFFDE047), Color(0xFF78350F))
}

enum class AssistantState {
    IDLE, THINKING, TALKING
}

class MainActivity : ComponentActivity() {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                KaoriScreen()
            }
        }
    }

    @Composable
    fun KaoriScreen() {
        var atmosphere by remember { mutableStateOf(CoreAtmosphere.CYAN) }
        var assistantState by remember { mutableStateOf(AssistantState.IDLE) }
        val messages = remember { mutableStateListOf<Message>() }
        var inputText by remember { mutableStateOf("") }
        val lazyListState = rememberLazyListState()
        val coroutineScope = rememberCoroutineScope()

        // Initial system introduction message
        LaunchedEffect(Unit) {
            if (messages.isEmpty()) {
                messages.add(
                    Message(
                        text = "Hello! I am Kaori, your holographic AI core companion. How may I assist you today?",
                        isUser = false
                    )
                )
            }
        }

        // Auto-scroll to bottom on new messages
        LaunchedEffect(messages.size) {
            if (messages.isNotEmpty()) {
                lazyListState.animateScrollToItem(messages.size - 1)
            }
        }

        fun sendPrompt(promptText: String) {
            if (promptText.isBlank()) return
            
            // Add user message
            messages.add(Message(text = promptText, isUser = true))
            inputText = ""
            assistantState = AssistantState.THINKING

            coroutineScope.launch {
                try {
                    val reply = callGeminiApi(promptText)
                    assistantState = AssistantState.TALKING
                    messages.add(Message(text = reply, isUser = false))
                    
                    // Simulate speaking duration then return to idle
                    val speakWords = reply.split(" ").size
                    val speakDelay = (speakWords * 180L).coerceIn(1500L, 6000L)
                    delay(speakDelay)
                    assistantState = AssistantState.IDLE
                } catch (e: Exception) {
                    assistantState = AssistantState.IDLE
                    messages.add(Message(text = "Error: ${e.localizedMessage ?: "Core connection failed."}", isUser = false))
                }
            }
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF0B132B))
        ) {
            // Radial Glow Background
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(300.dp)
                    .blur(100.dp)
                    .background(
                        Brush.radialGradient(
                            colors = listOf(atmosphere.primaryColor.copy(alpha = 0.25f), Color.Transparent),
                            radius = 400f
                        )
                    )
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Header Panel
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "KAORI // CORE V3.25",
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 1.5.sp
                        )
                        Text(
                            text = "HOLOGRAPHIC QUANTUM ASSISTANT",
                            color = Color.Gray,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Medium,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 1.sp
                        )
                    }

                    // Status Indicator
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(Color.White.copy(alpha = 0.05f))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        val infiniteTransition = rememberInfiniteTransition(label = "pulse")
                        val pulseAlpha by infiniteTransition.animateFloat(
                            initialValue = 0.4f,
                            targetValue = 1.0f,
                            animationSpec = infiniteRepeatable(
                                animation = tween(1000, easing = LinearEasing),
                                repeatMode = RepeatMode.Reverse
                            ),
                            label = "pulseAlpha"
                        )
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .clip(CircleShape)
                                .background(
                                    when (assistantState) {
                                        AssistantState.IDLE -> Color(0xFF10B981)
                                        AssistantState.THINKING -> Color(0xFF8B5CF6)
                                        AssistantState.TALKING -> Color(0xFF06B6D4)
                                    }.copy(alpha = pulseAlpha)
                                )
                        )
                        Text(
                            text = assistantState.name,
                            color = Color.White,
                            fontSize = 9.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // Core Visualizer Card
                Card(
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1C2541).copy(alpha = 0.6f)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .border(1.dp, atmosphere.primaryColor.copy(alpha = 0.2f), RoundedCornerShape(24.dp))
                ) {
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier.fillMaxSize()
                    ) {
                        HolographicCore(atmosphere = atmosphere, state = assistantState)
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Atmosphere Selectors
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "VIBE:",
                        color = Color.White.copy(alpha = 0.4f),
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(end = 4.dp)
                    )
                    CoreAtmosphere.values().forEach { item ->
                        val isSelected = atmosphere == item
                        Box(
                            modifier = Modifier
                                .size(24.dp)
                                .clip(CircleShape)
                                .background(item.primaryColor)
                                .border(
                                    width = 2.dp,
                                    color = if (isSelected) Color.White else Color.Transparent,
                                    shape = CircleShape
                                )
                                .clickable { atmosphere = item }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Chat Messages Feed
                LazyColumn(
                    state = lazyListState,
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(0xFF1C2541).copy(alpha = 0.3f))
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(messages) { message ->
                        ChatBubble(message = message, atmosphere = atmosphere)
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Preset Prompt Chips
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val presets = listOf(
                        "Tell me a story",
                        "Recommend lo-fi tracks",
                        "Tell me a joke"
                    )
                    presets.forEach { preset ->
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.White.copy(alpha = 0.05f))
                                .border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(12.dp))
                                .clickable { sendPrompt(preset) }
                                .padding(vertical = 8.dp, horizontal = 4.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = preset,
                                color = Color.White.copy(alpha = 0.8f),
                                fontSize = 10.sp,
                                textAlign = TextAlign.Center,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Input Bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .imePadding(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    TextField(
                        value = inputText,
                        onValueChange = { inputText = it },
                        placeholder = {
                            Text(
                                "Core prompt...",
                                color = Color.White.copy(alpha = 0.4f),
                                fontSize = 14.sp
                            )
                        },
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor = Color(0xFF1C2541),
                            unfocusedContainerColor = Color(0xFF1C2541),
                            focusedIndicatorColor = Color.Transparent,
                            unfocusedIndicatorColor = Color.Transparent,
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        ),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier
                            .weight(1f)
                            .border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(16.dp)),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                        keyboardActions = KeyboardActions(onSend = { sendPrompt(inputText) }),
                        singleLine = true
                    )

                    IconButton(
                        onClick = { sendPrompt(inputText) },
                        modifier = Modifier
                            .size(52.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(atmosphere.primaryColor)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Send,
                            contentDescription = "Send",
                            tint = Color.White
                        )
                    }
                }
            }
        }
    }

    @Composable
    fun HolographicCore(atmosphere: CoreAtmosphere, state: AssistantState) {
        val infiniteTransition = rememberInfiniteTransition(label = "core")

        // Animated values for beautiful hologram visual effect
        val breathingScale by infiniteTransition.animateFloat(
            initialValue = 0.85f,
            targetValue = 1.15f,
            animationSpec = infiniteRepeatable(
                animation = tween(2400, easing = SineToSineEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "breathing"
        )

        val rotationAngle by infiniteTransition.animateFloat(
            initialValue = 0f,
            targetValue = 360f,
            animationSpec = infiniteRepeatable(
                animation = tween(
                    when (state) {
                        AssistantState.IDLE -> 8000
                        AssistantState.THINKING -> 3000
                        AssistantState.TALKING -> 5000
                    },
                    easing = LinearEasing
                )
            ),
            label = "rotation"
        )

        val voiceExcitation by infiniteTransition.animateFloat(
            initialValue = -5f,
            targetValue = 5f,
            animationSpec = infiniteRepeatable(
                animation = tween(150, easing = LinearEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "voiceExcitation"
        )

        Canvas(modifier = Modifier.size(160.dp)) {
            val center = Offset(size.width / 2, size.height / 2)
            val baseRadius = 45.dp.toPx()
            val stateScale = when (state) {
                AssistantState.IDLE -> 1.0f
                AssistantState.THINKING -> 1.15f
                AssistantState.TALKING -> 1.08f + (voiceExcitation / 100f)
            }
            val radius = baseRadius * breathingScale * stateScale

            // Draw outer neon glow rings
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(atmosphere.primaryColor.copy(alpha = 0.4f), Color.Transparent),
                    center = center,
                    radius = radius * 2f
                ),
                radius = radius * 1.5f,
                center = center
            )

            // Draw spinning particle ring orbits
            val orbitStroke = Stroke(width = 1.dp.toPx())
            drawCircle(
                color = atmosphere.glowColor.copy(alpha = 0.25f),
                radius = radius * 1.3f,
                center = center,
                style = orbitStroke
            )

            // Dynamic voice or thinking ripples
            if (state == AssistantState.TALKING) {
                drawCircle(
                    color = atmosphere.glowColor.copy(alpha = 0.15f),
                    radius = radius * (1.5f + (voiceExcitation / 25f)),
                    center = center,
                    style = Stroke(width = 2.dp.toPx())
                )
            }

            // Draw central shining core orb
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(Color.White, atmosphere.primaryColor, atmosphere.secondaryColor),
                    center = center,
                    radius = radius
                ),
                radius = radius,
                center = center
            )
        }
    }

    @Composable
    fun ChatBubble(message: Message, atmosphere: CoreAtmosphere) {
        val isUser = message.isUser
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
        ) {
            Card(
                shape = RoundedCornerShape(
                    topStart = 16.dp,
                    topEnd = 16.dp,
                    bottomStart = if (isUser) 16.dp else 4.dp,
                    bottomEnd = if (isUser) 4.dp else 16.dp
                ),
                colors = CardDefaults.cardColors(
                    containerColor = if (isUser) atmosphere.primaryColor else Color(0xFF1C2541)
                ),
                modifier = Modifier
                    .widthIn(max = 280.dp)
                    .border(
                        width = 1.dp,
                        color = if (isUser) Color.White.copy(alpha = 0.15f) else atmosphere.primaryColor.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(
                            topStart = 16.dp,
                            topEnd = 16.dp,
                            bottomStart = if (isUser) 16.dp else 4.dp,
                            bottomEnd = if (isUser) 4.dp else 16.dp
                        )
                    )
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = message.text,
                        color = Color.White,
                        fontSize = 13.sp,
                        lineHeight = 18.sp
                    )
                }
            }
        }
    }

    private suspend fun callGeminiApi(prompt: String): String = withContext(Dispatchers.IO) {
        val apiKey = BuildConfig.GEMINI_API_KEY
        if (apiKey.isBlank()) {
            return@withContext "Kaori Core offline. Please configure your API Key in Settings > Secrets."
        }

        val url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=$apiKey"
        val requestBodyJson = JSONObject().apply {
            put("contents", JSONObject().apply {
                put("parts", JSONObject().apply {
                    put("text", "You are a witty, extremely helpful holographic companion named Kaori. Respond concisely to: $prompt")
                })
            })
        }

        val body = requestBodyJson.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url(url)
            .post(body)
            .header("User-Agent", "aistudio-build")
            .build()

        try {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext "Failed to ping quantum core: Code ${response.code}"
                }
                val responseBodyStr = response.body?.string() ?: return@withContext "Empty response from AI Core."
                val jsonResponse = JSONObject(responseBodyStr)
                val candidates = jsonResponse.optJSONArray("candidates")
                if (candidates != null && candidates.length() > 0) {
                    val firstCandidate = candidates.getJSONObject(0)
                    val content = firstCandidate.optJSONObject("content")
                    if (content != null) {
                        val parts = content.optJSONArray("parts")
                        if (parts != null && parts.length() > 0) {
                            return@withContext parts.getJSONObject(0).optString("text", "Empty reply.")
                        }
                    }
                }
                "Response format mismatch."
            }
        } catch (e: Exception) {
            "Core connection error: ${e.message}"
        }
    }
}

// Custom Easing to prevent standard Jetpack Compose import error
val SineToSineEasing = Easing { fraction ->
    (Math.sin(fraction * Math.PI - Math.PI / 2) + 1).toFloat() / 2f
}
