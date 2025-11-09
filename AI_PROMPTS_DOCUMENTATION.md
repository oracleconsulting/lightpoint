## AI Prompts Documentation - Enhanced Version

### Claude Sonnet 4.5 - Analysis Prompt

**Model:** `anthropic/claude-sonnet-4.5`  
**Context Window:** 1,000,000 tokens  
**Temperature:** 0.3 (lower for consistent analysis)  
**Purpose:** Comprehensive complaint analysis across ALL tax areas

**Key Enhancements:**
- ✅ **12 complaint categories** (not just generic)
- ✅ **Timeline analysis** with gap detection (>3 months)
- ✅ **System error detection** (inter-departmental failures)
- ✅ **7 CRG violations** tracked (CRG4025, 5225, 6050-6075, 5100, 3250, 5350, 6150)
- ✅ **Breakthrough triggers** identification
- ✅ **Compensation estimates** (professional fees + distress)
- ✅ **Escalation recommendations** (Tier 1/2/Adjudicator)

**Complaint Categories:**
1. Late Filing Penalties
2. System/Administrative Errors
3. Delayed Responses
4. Tax Code/Assessment Errors
5. Repayment Issues
6. CIS Scheme Issues
7. VAT Processing
8. Corporation Tax
9. R&D Tax Credits
10. SEIS/EIS Claims
11. Inter-departmental Failures
12. Data Migration Issues

**Timeline Analysis:**
- Calculates total duration (flags if >12 months)
- Identifies gaps >3 months between communications
- Notes if response times exceed:
  * 15 working days (general correspondence)
  * 28 days (complaint response)
  * 30 days (VAT/repayment claims)
  * 8 weeks (complaint trigger threshold)

**System Error Detection:**
- PAYE/SA integration failures
- Payment allocation errors
- Automated penalties despite cancellation
- Data migration issues
- Contradictory online/written information

**Evidence Assessment:**
- Screenshots of online accounts
- Fax transmission confirmations
- Bank statements
- Mathematical calculation errors
- Contradictory HMRC correspondence

**Enhanced Output Format:**
```json
{
  "hasGrounds": boolean,
  "complaintCategory": [string],
  "violations": [{
    "type": string,
    "description": string,
    "citation": string,
    "severity": "high|medium|low"
  }],
  "timeline": {
    "totalDuration": "X months",
    "longestGap": "X months",
    "missedDeadlines": number
  },
  "systemErrors": [{
    "type": string,
    "departments": [string]
  }],
  "breakthroughTriggers": [string],
  "actions": [string],
  "compensationEstimate": {
    "professionalFees": string,
    "distressPayment": string
  },
  "successRate": number (0-100),
  "escalationRequired": "Tier1|Tier2|Adjudicator",
  "reasoning": string
}
```

### Claude Opus 4.1 - Letter Generation Prompt

**Model:** `anthropic/claude-opus-4.1`  
**Context Window:** 200,000 tokens  
**Temperature:** 0.7 (higher for creative professional writing)  
**Purpose:** Generate Adjudicator-level complaint letters across ALL tax areas

**Key Enhancements:**
- ✅ **Complaint type adaptation** (penalties, VAT, CIS, R&D, SEIS, etc.)
- ✅ **6-10 timeline entries** minimum (increased from 5-8)
- ✅ **Progressive tone escalation** through timeline
- ✅ **Delivery method notation** (post, email, fax)
- ✅ **Inter-departmental failure language**
- ✅ **Mathematical contradiction highlighting**
- ✅ **Vulnerable client considerations**
- ✅ **Evidence enclosure list**
- ✅ **Fax/helpline references**
- ✅ **Screenshot references**

**Complaint Type Adaptation:**
- **Penalties**: Focus on reasonable excuse, HMRC delays causing issue
- **System Errors**: Emphasize inter-departmental coordination failures
- **CIS Issues**: Reference specific helpline conversations and dates
- **VAT**: Cite 30-day service standards explicitly
- **R&D/SEIS**: Highlight innovation impact and investment delays
- **Repayments**: Calculate interest from original due date

**Progressive Tone Escalation:**
```
Month 1-2: "requested", "submitted"
Month 3-4: "chased", "no response received"
Month 5-6: "formal complaint", "expressed concern"
Month 7-8: "strongly objected", "completely unacceptable"
Month 9+: "comprehensive failure", "systemic breakdown"
```

**Mandatory Letter Structure:**
1. Professional Letterhead (practice details or realistic template)
2. Delivery Method ("By post and email" or "By post and fax: [number]")
3. Subject Line: "FORMAL COMPLAINT: [Issue] - [Duration] Delay - Ref: [Ref]"
4. Opening (assertive, comprehensive failure statement)
5. **Chronological Timeline** (6-10 entries minimum)
6. **Charter Violations and CRG Breaches** (minimum 4 violations)
7. **Impact Statement** (financial, professional, client distress)
8. **Resolution Required** (7-10 specific numbered actions)
9. **Professional Costs Section** (quantified with increasing burden)
10. **Response Required** (15 days + escalation warning)
11. **Closing** (Yours faithfully + evidence list)

**CRG Citations (7 tracked):**
- CRG4025: Unreasonable delays and remedy
- CRG5225: Professional fees reimbursement  
- CRG6050-6075: Compensation for distress
- CRG5100: Financial redress considerations
- CRG3250: System failures and lost correspondence
- CRG5350: Complaint costs
- CRG6150: Poor complaint handling

**Breakthrough Triggers (minimum 2-3):**
- "comprehensively breached"
- "completely unacceptable"  
- "significantly below the standards"
- "which is the only reasonable outcome"
- "routinely upheld by the Adjudicator"
- "pattern of systemic failures"
- "contradicts HMRC's own guidance"
- "public purse implications"
- "placing further burden upon the public purse"
- "exceeds reasonable timeframes by X%"
- "1,200% beyond reasonable timeframes"

**Special Language Additions:**

*For inter-departmental failures:*
> "This appears to be another case where [Department A] has failed to communicate with [Department B], resulting in contradictory actions that violate 'Making Things Easy'."

*For calculation errors:*
> "By carrying out simple arithmetic, the figures in your letter dated [date] contradict those shown on our client's online account (screenshot enclosed)."

*For vulnerable clients:*
> "Our client [is elderly/has health conditions/faces hardship], making these delays particularly distressing per CRG6050."

**Evidence Enclosure List:**
```
Enc:
- Original submission dated [date]
- Chase correspondence dated [dates]
- Screenshots showing [specific contradiction]
- Fax confirmations dated [dates]
- [Other specific evidence]
```

**Quality Validation (14 checks):**
□ No placeholder brackets remain  
□ Timeline shows 6-10 dated entries  
□ Minimum 4 specific CRG references  
□ All Charter violations named  
□ Specific monetary amounts included  
□ Professional letterhead used  
□ Strong breakthrough triggers throughout  
□ Progressive tone escalation evident  
□ Clear escalation warning (Tier 1→2→Adjudicator)  
□ Fee recovery quantified  
□ Evidence list provided  
□ Delivery method noted  
□ Mathematical contradictions highlighted (if applicable)  
□ Inter-departmental failures noted (if applicable)

## How They Work Together

1. **Sonnet 4.5 analyzes** (1M context, $3/M):
   - Reads ALL documents in full detail (Stage 1 + Stage 2)
   - Categorizes complaint type (12 categories)
   - Calculates timeline gaps and missed deadlines
   - Detects system errors and inter-departmental failures
   - Searches knowledge base comprehensively (multi-angle)
   - Identifies Charter violations (minimum 4)
   - Tracks 7 CRG violations
   - Identifies breakthrough triggers
   - Estimates compensation ranges
   - Provides structured JSON analysis
   - **Cost-effective for heavy analysis work**

2. **Opus 4.1 generates letter** (200K context, $15/M):
   - Takes the structured analysis from Sonnet
   - Adapts approach to complaint type
   - Crafts 6-10 entry timeline with progressive tone
   - Includes all mandatory sections
   - Uses strong breakthrough language
   - Adds special language for errors/vulnerable clients
   - Quantifies professional costs
   - Includes evidence enclosure list
   - Ready-to-send quality
   - **Premium writing for final output only**

3. **Practice Settings Integration**:
   - User configures firm details once
   - Letterhead auto-populated in every letter
   - Charge-out rate used for fee calculations
   - No placeholders ever needed

## Example Analysis Output (Enhanced)

```json
{
  "hasGrounds": true,
  "complaintCategory": ["SEIS/EIS Claims", "Delayed Responses", "System/Administrative Errors"],
  "violations": [
    {
      "type": "Unreasonable Delay",
      "description": "14+ month delay exceeds standard 28-30 days for SEIS claims by 1,200%",
      "citation": "CRG4025 - Unreasonable delays",
      "severity": "high"
    },
    {
      "type": "Lost Correspondence",
      "description": "November 2024 letter claimed sent but never received, no copy provided when requested",
      "citation": "CRG3250 - System failures",
      "severity": "high"
    },
    {
      "type": "Contradictory Instructions",
      "description": "March 2025 instructed SEIS3 forms, October 2025 contradicted this instruction",
      "citation": "Charter: Making Things Easy",
      "severity": "medium"
    },
    {
      "type": "Failure to Respond",
      "description": "Multiple chase correspondence from April-September 2025 ignored",
      "citation": "Charter: Being Responsive",
      "severity": "high"
    }
  ],
  "timeline": {
    "totalDuration": "14 months",
    "longestGap": "9 months (February-November 2024)",
    "missedDeadlines": 6
  },
  "systemErrors": [
    {
      "type": "Lost correspondence with no copy available",
      "departments": ["SEIS Processing", "Correspondence Team"]
    },
    {
      "type": "Contradictory instructions between departments",
      "departments": ["SEIS Processing", "Forms Department"]
    }
  ],
  "breakthroughTriggers": [
    "14-month delay (1,200% beyond standard timeframe)",
    "Multiple inter-departmental coordination failures",
    "Pattern of lost correspondence and contradictory guidance",
    "Public purse waste due to increasing professional fees"
  ],
  "actions": [
    "File Tier 1 complaint with 15 working day response deadline",
    "Request immediate processing of February 2024 SEIS claim",
    "Request written explanation of lost November 2024 letter",
    "Request clarification of contradictory SEIS3 instructions",
    "Request compensation per CRG6050-6075 (£500 appropriate)",
    "Request professional fee reimbursement per CRG5225",
    "Request interest from February 2024 submission date",
    "Request system review confirmation to prevent recurrence"
  ],
  "compensationEstimate": {
    "professionalFees": "£2,220 (12 hours at £185/hour, increasing daily)",
    "distressPayment": "£500 (upper end justified by 14-month duration and multiple failures)"
  },
  "successRate": 92,
  "escalationRequired": "Tier1",
  "reasoning": "Strong grounds for complaint based on: (1) Unreasonable 14-month delay exceeding standard timeframe by 1,200%, (2) Lost correspondence with no copy available despite requests, (3) Contradictory instructions causing wasted professional time, (4) Pattern of ignored follow-ups. Multiple Charter violations and CRG breaches. Similar cases with this pattern routinely upheld by Adjudicator's Office. Recommend Tier 1 with strong escalation warning given clear evidence of systemic failures."
}
```

## Cost Optimization Summary

**Before (Opus-only approach):**
- Analysis: $15/M tokens × 250K = $3.75
- Letter: $15/M tokens × 50K = $0.75
- **Total: $4.50 per complaint**

**After (Hybrid Sonnet + Opus):**
- Analysis: $3/M tokens × 250K = $0.75
- Letter: $15/M tokens × 50K = $0.75  
- **Total: $1.50 per complaint**
- **Savings: 67% ($3.00 per complaint)**

**Quality improvements:**
- More comprehensive analysis (12 categories vs generic)
- Better timeline tracking (gap detection, missed deadlines)
- System error identification
- Breakthrough trigger recognition
- Compensation estimation
- Superior letter quality (each model optimized for task)

**Result:** Better quality at 1/3 the cost! 🎉

