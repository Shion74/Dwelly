const { generateSecurityReport } = require('../middleware/auditSystem');
const fs = require('fs').promises;
const path = require('path');

async function createSecurityReport(timeframe = '7 days', outputFormat = 'console') {
    try {
        console.log(`📊 Generating Dwelly Security Report (${timeframe})...\n`);

        const report = await generateSecurityReport(timeframe);
        
        if (!report) {
            console.error('❌ Failed to generate security report');
            process.exit(1);
        }

        // Format report for display
        const formattedReport = formatSecurityReport(report);

        if (outputFormat === 'console') {
            console.log(formattedReport);
        } else if (outputFormat === 'file') {
            const filename = `security-report-${new Date().toISOString().split('T')[0]}.txt`;
            const reportPath = path.join(__dirname, '../reports', filename);
            
            // Ensure reports directory exists
            await fs.mkdir(path.dirname(reportPath), { recursive: true });
            
            await fs.writeFile(reportPath, formattedReport);
            console.log(`📁 Security report saved to: ${reportPath}`);
        } else if (outputFormat === 'json') {
            const filename = `security-report-${new Date().toISOString().split('T')[0]}.json`;
            const reportPath = path.join(__dirname, '../reports', filename);
            
            await fs.mkdir(path.dirname(reportPath), { recursive: true });
            await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
            console.log(`📁 Security report (JSON) saved to: ${reportPath}`);
        }

        // Generate recommendations
        const recommendations = generateRecommendations(report);
        console.log('\n🎯 Security Recommendations:');
        console.log('=' * 50);
        recommendations.forEach((rec, index) => {
            console.log(`${index + 1}. ${rec}`);
        });

    } catch (error) {
        console.error('❌ Error generating security report:', error);
        process.exit(1);
    } finally {
        if (outputFormat === 'console') {
            process.exit(0);
        }
    }
}

function formatSecurityReport(report) {
    let output = `
DWELLY SECURITY REPORT
Generated: ${report.generatedAt}
Timeframe: ${report.timeframe}
${'='.repeat(60)}

SECURITY EVENTS SUMMARY
${'='.repeat(60)}
`;

    if (report.securityEvents.length === 0) {
        output += "No security events recorded in this timeframe.\n\n";
    } else {
        report.securityEvents.forEach(event => {
            output += `${event.action_type.toUpperCase()} (${event.status}/${event.severity}): ${event.count} events from ${event.unique_ips} unique IPs\n`;
        });
        output += "\n";
    }

    output += `FAILED LOGIN ATTEMPTS
${'='.repeat(60)}
`;

    if (report.failedLogins.length === 0) {
        output += "No failed login attempts recorded.\n\n";
    } else {
        output += "Top Failed Login Attempts:\n";
        report.failedLogins.slice(0, 10).forEach((attempt, index) => {
            output += `${index + 1}. IP: ${attempt.ip_address} | Email: ${attempt.email || 'N/A'} | Attempts: ${attempt.attempt_count} | Blocked: ${attempt.is_blocked ? 'YES' : 'NO'}\n`;
        });
        output += "\n";
    }

    output += `CONTENT MODERATION
${'='.repeat(60)}
`;

    if (report.contentModeration.length === 0) {
        output += "No content moderation actions recorded.\n\n";
    } else {
        const moderationSummary = {};
        report.contentModeration.forEach(action => {
            const key = `${action.content_type}_${action.action_taken}`;
            moderationSummary[key] = (moderationSummary[key] || 0) + action.count;
        });

        Object.entries(moderationSummary).forEach(([key, count]) => {
            const [type, action] = key.split('_');
            output += `${type.toUpperCase()} ${action.replace('_', ' ').toUpperCase()}: ${count}\n`;
        });
        output += "\n";
    }

    output += `SUSPICIOUS ACTIVITY
${'='.repeat(60)}
`;

    if (report.suspiciousActivity.length === 0) {
        output += "No suspicious activity detected.\n\n";
    } else {
        output += "Top Suspicious IPs:\n";
        report.suspiciousActivity.forEach((activity, index) => {
            output += `${index + 1}. IP: ${activity.ip_address} | User: ${activity.user_id || 'Anonymous'} | Incidents: ${activity.incident_count}\n`;
        });
        output += "\n";
    }

    return output;
}

function generateRecommendations(report) {
    const recommendations = [];

    // Analyze failed logins
    const highFailureIPs = report.failedLogins.filter(attempt => attempt.attempt_count >= 5);
    if (highFailureIPs.length > 0) {
        recommendations.push(`Consider blocking ${highFailureIPs.length} IP addresses with excessive failed login attempts`);
    }

    // Analyze content moderation
    const rejectedContent = report.contentModeration.filter(action => 
        action.action_taken.includes('rejected') || action.action_taken.includes('flagged')
    );
    if (rejectedContent.length > 0) {
        const totalRejected = rejectedContent.reduce((sum, action) => sum + action.count, 0);
        if (totalRejected > 10) {
            recommendations.push(`High content rejection rate (${totalRejected} items) - review moderation settings`);
        }
    }

    // Analyze suspicious activity
    if (report.suspiciousActivity.length > 5) {
        recommendations.push("Multiple suspicious activity sources detected - consider implementing stricter IP filtering");
    }

    // Check for automation
    const manualModeration = report.contentModeration.filter(action => !action.is_automated);
    if (manualModeration.length > 0) {
        const totalManual = manualModeration.reduce((sum, action) => sum + action.count, 0);
        recommendations.push(`${totalManual} items require manual moderation - consider automating common cases`);
    }

    // Security events analysis
    const criticalEvents = report.securityEvents.filter(event => event.severity === 'critical' || event.severity === 'high');
    if (criticalEvents.length > 0) {
        recommendations.push("Critical/high severity security events detected - immediate investigation required");
    }

    // General recommendations
    if (recommendations.length === 0) {
        recommendations.push("Security posture appears good - maintain current monitoring");
        recommendations.push("Consider running security scans weekly for proactive monitoring");
    } else {
        recommendations.push("Schedule a security review meeting to address identified issues");
        recommendations.push("Update security incident response procedures if needed");
    }

    recommendations.push("Ensure all team members are trained on security best practices");
    recommendations.push("Keep security dependencies updated regularly");

    return recommendations;
}

// Command line interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const timeframe = args[0] || '7 days';
    const format = args[1] || 'console';

    if (!['24 hours', '7 days', '30 days'].includes(timeframe)) {
        console.error('❌ Invalid timeframe. Use: "24 hours", "7 days", or "30 days"');
        process.exit(1);
    }

    if (!['console', 'file', 'json'].includes(format)) {
        console.error('❌ Invalid format. Use: "console", "file", or "json"');
        process.exit(1);
    }

    createSecurityReport(timeframe, format);
}

module.exports = { createSecurityReport, formatSecurityReport, generateRecommendations }; 