# Knowledge Uploads Folder

Place your HMRC Charter documents, CRG guidance, precedents, and other knowledge documents here for automatic processing and upload to Supabase.

## 📁 Folder Structure

```
knowledge-uploads/
├── charter/              ← HMRC Charter documents
│   └── Your Charter.pdf
├── crg-guidance/         ← Complaint Resolution Guidance
│   └── CRG Manual.pdf
├── precedents/           ← Past successful cases (MUST be anonymized!)
│   └── precedent-001.txt
├── service-standards/    ← HMRC service timeframes
│   └── Service Standards.pdf
└── prompts/              ← Custom LLM prompts
    └── analysis-prompt.txt
```

## 📄 Supported File Formats

- **PDF** (`.pdf`) - Recommended for official documents
- **Text** (`.txt`) - Good for simple documents
- **Markdown** (`.md`) - Good for structured documents
- **Word** (`.docx`) - Requires mammoth package (or convert to PDF)

## 🚀 How to Use

### 1. Place Your Documents

Copy your documents into the appropriate folders:

```bash
# Example: Add HMRC Charter
cp ~/Documents/HMRC-Charter-2020.pdf knowledge-uploads/charter/

# Example: Add CRG guidance
cp ~/Documents/CRG-Manual.pdf knowledge-uploads/crg-guidance/

# Example: Add precedent cases
cp ~/Documents/precedents/*.txt knowledge-uploads/precedents/
```

### 2. Run the Processor

```bash
npm install tsx  # If not already installed
npx tsx scripts/process-knowledge-uploads.ts
```

The script will:
- ✅ Extract text from all documents
- ✅ Generate embeddings automatically
- ✅ Upload to Supabase knowledge base
- ✅ Report success/failures

### 3. Verify in Lightpoint

Go to: `https://your-app.railway.app/knowledge`

Search for terms from your documents to verify they're searchable.

## ⚠️ Important: Privacy & Precedents

**CRITICAL:** Precedent cases MUST be fully anonymized before upload!

Remove ALL:
- ❌ Client names
- ❌ UTRs, NINOs
- ❌ Addresses
- ❌ Bank details
- ❌ Any identifiable information

Use:
- ✅ "CLIENT-001" instead of names
- ✅ "[REDACTED]" for removed info
- ✅ Generic descriptions
- ✅ Focus on legal arguments and outcomes

## 📝 Naming Conventions

Good filenames help with organization:

```
✅ Good:
- HMRC-Charter-2020.pdf
- CRG-Delay-Complaints.pdf
- Precedent-VAT-Delay-Compensation.txt
- Service-Standards-2024.pdf

❌ Avoid:
- document.pdf
- file1.pdf
- temp.txt
```

## 🔧 Troubleshooting

### "No documents found"
- Check files are in correct folders
- Verify file extensions (.pdf, .txt, .md)
- Ensure files aren't empty

### "Failed to extract PDF"
- Try converting to TXT format
- Check PDF isn't password protected
- Ensure PDF contains actual text (not just images)

### "Content too short"
- Ensure document has at least 50 characters
- Check PDF extracted correctly
- Try converting scanned PDFs with OCR first

### "DOCX support requires mammoth"
Either:
- Convert DOCX to PDF or TXT
- Or install: `npm install mammoth`

## 📊 What Gets Created

For each document, the system creates:
- **Title**: From filename (auto-formatted)
- **Category**: From folder name
- **Content**: Extracted text (anonymized)
- **Embedding**: 1536-dimension vector for semantic search
- **Source**: Original filename for reference

## 🎯 Best Practices

1. **Organize by Type**: Use the folder structure
2. **One Topic Per File**: Split large documents
3. **Clear Filenames**: Descriptive names help
4. **Keep Updated**: Replace old versions
5. **Test Search**: Verify documents are findable

## 🔄 Updating Knowledge

To update existing documents:
1. Delete or rename old file in folder
2. Add new version
3. Run processor again
4. Old entries remain unless manually deleted in Supabase

## 💡 Example Workflow

```bash
# 1. Get your documents ready
cd ~/Documents/HMRC-Documents

# 2. Copy to upload folders
cp "Your Charter.pdf" ~/path/to/lightpoint/knowledge-uploads/charter/
cp "CRG Manual.pdf" ~/path/to/lightpoint/knowledge-uploads/crg-guidance/
cp precedent-*.txt ~/path/to/lightpoint/knowledge-uploads/precedents/

# 3. Process them
cd ~/path/to/lightpoint
npx tsx scripts/process-knowledge-uploads.ts

# 4. Verify
# Go to your app and search for key terms
```

## 📞 Need Help?

If documents aren't processing:
1. Check the console output for specific errors
2. Try converting problematic PDFs to TXT
3. Ensure environment variables are set (OPENAI_API_KEY, SUPABASE keys)
4. Check Supabase connection is working

---

**Ready to upload?** Place your documents in the folders above and run the processor! 🚀
