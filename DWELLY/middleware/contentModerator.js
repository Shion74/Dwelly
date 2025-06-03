const { logContentModeration } = require('./auditSystem');
const Filter = require('bad-words');
const validator = require('validator');

// Initialize content filters
const profanityFilter = new Filter();

// Housing-specific spam and scam patterns
const SPAM_PATTERNS = [
    /\b(urgent|asap|call now|limited time|act fast|hurry|quick)\b/gi,
    /\b(100% guaranteed|money back|no risk|free money|get rich)\b/gi,
    /\b(click here|visit now|buy now|order now|signup now)\b/gi,
    /\b(congratulations|winner|selected|chosen|prize)\b/gi,
    /\b(bitcoin|crypto|investment|forex|trading|stocks)\b/gi,
    /\$([\d,]+)\s*(per|\/)\s*(hour|day|week|month)\s*from\s*home/gi
];

const SCAM_PATTERNS = [
    /\b(western union|money gram|wire transfer|bank transfer|cash advance)\b/gi,
    /\b(send money|transfer funds|pay upfront|advance payment|security deposit)\b/gi,
    /\b(fake|scam|fraud|cheat|steal|lie|illegal|drugs|weapons)\b/gi,
    /\b(too good to be true|unbelievable deal|amazing offer)\b/gi,
    /\b(lottery|sweepstakes|inheritance|deceased|will|testament)\b/gi
];

const SUSPICIOUS_HOUSING_PATTERNS = [
    /\b(no deposit|no questions asked|cash only|immediate move in)\b/gi,
    /\b(perfect condition|luxury|furnished|all inclusive)\s*.{0,50}\$?[1-9]\d{2,3}\b/gi, // Luxury for very low price
    /\b(owner overseas|military deployment|family emergency|quick sale)\b/gi,
    /\b(send photos|more pictures|additional images)\s*via\s*(email|text|whatsapp)/gi
];

// Content quality checks
const QUALITY_INDICATORS = {
    MIN_DESCRIPTION_LENGTH: 50,
    MAX_DESCRIPTION_LENGTH: 2000,
    MIN_PRICE: 1000,
    MAX_PRICE: 50000,
    REQUIRED_FIELDS: ['description', 'landlord_name', 'contact_number', 'street', 'barangay'],
    SUSPICIOUS_REPETITION_THRESHOLD: 3
};

// Analyze content for various threats
const analyzeContent = async (content, contentType = 'post') => {
    const analysis = {
        score: 0, // 0-100, higher = more suspicious
        flags: [],
        reasons: [],
        recommendation: 'approve', // approve, review, reject
        confidence: 0
    };

    try {
        // Check for profanity
        const profanityCheck = checkProfanity(content);
        if (profanityCheck.detected) {
            analysis.score += 30;
            analysis.flags.push('profanity');
            analysis.reasons.push(`Profanity detected: ${profanityCheck.words.join(', ')}`);
        }

        // Check for spam patterns
        const spamCheck = checkSpamPatterns(content);
        if (spamCheck.detected) {
            analysis.score += spamCheck.severity;
            analysis.flags.push('spam');
            analysis.reasons.push(`Spam indicators: ${spamCheck.patterns.join(', ')}`);
        }

        // Check for scam patterns
        const scamCheck = checkScamPatterns(content);
        if (scamCheck.detected) {
            analysis.score += scamCheck.severity;
            analysis.flags.push('scam');
            analysis.reasons.push(`Scam indicators: ${scamCheck.patterns.join(', ')}`);
        }

        // Check for suspicious housing patterns
        const housingCheck = checkSuspiciousHousingPatterns(content);
        if (housingCheck.detected) {
            analysis.score += housingCheck.severity;
            analysis.flags.push('suspicious_housing');
            analysis.reasons.push(`Suspicious housing patterns: ${housingCheck.patterns.join(', ')}`);
        }

        // Check content quality for posts
        if (contentType === 'post') {
            const qualityCheck = checkContentQuality(content);
            analysis.score += qualityCheck.score;
            analysis.flags.push(...qualityCheck.flags);
            analysis.reasons.push(...qualityCheck.reasons);
        }

        // Determine recommendation based on score
        if (analysis.score >= 70) {
            analysis.recommendation = 'reject';
            analysis.confidence = 0.9;
        } else if (analysis.score >= 40) {
            analysis.recommendation = 'review';
            analysis.confidence = 0.7;
        } else {
            analysis.recommendation = 'approve';
            analysis.confidence = 0.8;
        }

        return analysis;

    } catch (error) {
        console.error('Error analyzing content:', error);
        return {
            score: 50,
            flags: ['analysis_error'],
            reasons: ['Content analysis failed'],
            recommendation: 'review',
            confidence: 0.1
        };
    }
};

// Check for profanity
const checkProfanity = (content) => {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const words = profanityFilter.list.filter(word => 
        new RegExp(`\\b${word}\\b`, 'gi').test(text)
    );
    
    return {
        detected: words.length > 0,
        words: words,
        severity: words.length * 10
    };
};

// Check for spam patterns
const checkSpamPatterns = (content) => {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const detectedPatterns = [];
    let severity = 0;

    SPAM_PATTERNS.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
            detectedPatterns.push(matches[0]);
            severity += 15;
        }
    });

    return {
        detected: detectedPatterns.length > 0,
        patterns: detectedPatterns,
        severity: Math.min(severity, 50) // Cap at 50
    };
};

// Check for scam patterns
const checkScamPatterns = (content) => {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const detectedPatterns = [];
    let severity = 0;

    SCAM_PATTERNS.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
            detectedPatterns.push(matches[0]);
            severity += 25; // Scam patterns are more serious
        }
    });

    return {
        detected: detectedPatterns.length > 0,
        patterns: detectedPatterns,
        severity: Math.min(severity, 80) // Cap at 80
    };
};

// Check for suspicious housing patterns
const checkSuspiciousHousingPatterns = (content) => {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const detectedPatterns = [];
    let severity = 0;

    SUSPICIOUS_HOUSING_PATTERNS.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
            detectedPatterns.push(matches[0]);
            severity += 20;
        }
    });

    return {
        detected: detectedPatterns.length > 0,
        patterns: detectedPatterns,
        severity: Math.min(severity, 60) // Cap at 60
    };
};

// Check content quality
const checkContentQuality = (postData) => {
    const analysis = { score: 0, flags: [], reasons: [] };

    // Check description length
    if (postData.description) {
        if (postData.description.length < QUALITY_INDICATORS.MIN_DESCRIPTION_LENGTH) {
            analysis.score += 15;
            analysis.flags.push('short_description');
            analysis.reasons.push('Description too short');
        }
        if (postData.description.length > QUALITY_INDICATORS.MAX_DESCRIPTION_LENGTH) {
            analysis.score += 10;
            analysis.flags.push('long_description');
            analysis.reasons.push('Description too long');
        }
    }

    // Check price reasonableness
    if (postData.price) {
        const price = parseFloat(postData.price);
        if (price < QUALITY_INDICATORS.MIN_PRICE) {
            analysis.score += 25;
            analysis.flags.push('unrealistic_low_price');
            analysis.reasons.push('Price suspiciously low');
        }
        if (price > QUALITY_INDICATORS.MAX_PRICE) {
            analysis.score += 15;
            analysis.flags.push('unrealistic_high_price');
            analysis.reasons.push('Price suspiciously high');
        }
    }

    // Check for missing required fields
    const missingFields = QUALITY_INDICATORS.REQUIRED_FIELDS.filter(
        field => !postData[field] || !postData[field].trim()
    );
    if (missingFields.length > 0) {
        analysis.score += missingFields.length * 5;
        analysis.flags.push('missing_fields');
        analysis.reasons.push(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Check for excessive repetition
    if (postData.description) {
        const words = postData.description.toLowerCase().split(/\s+/);
        const wordCount = {};
        words.forEach(word => {
            if (word.length > 3) { // Only check words longer than 3 characters
                wordCount[word] = (wordCount[word] || 0) + 1;
            }
        });

        const excessiveWords = Object.entries(wordCount)
            .filter(([word, count]) => count >= QUALITY_INDICATORS.SUSPICIOUS_REPETITION_THRESHOLD)
            .map(([word]) => word);

        if (excessiveWords.length > 0) {
            analysis.score += 10;
            analysis.flags.push('excessive_repetition');
            analysis.reasons.push(`Excessive word repetition: ${excessiveWords.join(', ')}`);
        }
    }

    return analysis;
};

// Moderate post creation
const moderatePostCreation = async (req, res, next) => {
    try {
        const analysis = await analyzeContent(req.body, 'post');
        
        // Log the moderation decision
        await logContentModeration({
            content_type: 'post',
            user_id: req.session.user?.id,
            action_taken: analysis.recommendation === 'approve' ? 'auto_approved' :
                         analysis.recommendation === 'review' ? 'manual_review' :
                         'auto_rejected',
            original_content: JSON.stringify(req.body),
            reason: analysis.reasons.join('; '),
            confidence_score: analysis.confidence,
            is_automated: true
        });

        // Handle based on recommendation
        if (analysis.recommendation === 'reject') {
            return res.status(400).json({
                error: 'Post content violates community guidelines',
                details: analysis.reasons,
                code: 'CONTENT_REJECTED'
            });
        }

        if (analysis.recommendation === 'review') {
            // Flag for manual review but allow creation
            req.body.is_flagged = true;
            req.body.moderation_notes = analysis.reasons.join('; ');
        }

        // Add moderation metadata to request
        req.moderationAnalysis = analysis;
        next();

    } catch (error) {
        console.error('Content moderation error:', error);
        // Continue with post creation if moderation fails
        next();
    }
};

// Moderate user profile updates
const moderateProfileUpdate = async (req, res, next) => {
    try {
        const profileContent = {
            full_name: req.body.full_name,
            // Add other profile fields that need moderation
        };

        const analysis = await analyzeContent(profileContent, 'user_profile');
        
        await logContentModeration({
            content_type: 'user_profile',
            user_id: req.session.user?.id,
            action_taken: analysis.recommendation === 'approve' ? 'auto_approved' :
                         analysis.recommendation === 'review' ? 'manual_review' :
                         'auto_rejected',
            original_content: JSON.stringify(profileContent),
            reason: analysis.reasons.join('; '),
            confidence_score: analysis.confidence,
            is_automated: true
        });

        if (analysis.recommendation === 'reject') {
            return res.status(400).json({
                error: 'Profile content violates community guidelines',
                details: analysis.reasons,
                code: 'PROFILE_REJECTED'
            });
        }

        next();

    } catch (error) {
        console.error('Profile moderation error:', error);
        next();
    }
};

// Batch analyze existing content (for cleanup)
const batchAnalyzeContent = async (limit = 100) => {
    try {
        const [posts] = await pool.query(`
            SELECT post_id, user_id, description, landlord_name, 
                   contact_number, street, barangay, price
            FROM posts 
            WHERE is_flagged = FALSE AND is_deleted = 0
            ORDER BY created_at DESC
            LIMIT ?
        `, [limit]);

        const results = [];

        for (const post of posts) {
            const analysis = await analyzeContent(post, 'post');
            
            if (analysis.recommendation !== 'approve') {
                results.push({
                    post_id: post.post_id,
                    user_id: post.user_id,
                    analysis
                });

                // Update post if flagged
                if (analysis.recommendation === 'review' || analysis.recommendation === 'reject') {
                    await pool.query(
                        'UPDATE posts SET is_flagged = TRUE WHERE post_id = ?',
                        [post.post_id]
                    );
                }
            }
        }

        return results;

    } catch (error) {
        console.error('Batch analysis error:', error);
        return [];
    }
};

module.exports = {
    analyzeContent,
    moderatePostCreation,
    moderateProfileUpdate,
    batchAnalyzeContent,
    checkProfanity,
    checkSpamPatterns,
    checkScamPatterns,
    QUALITY_INDICATORS
}; 