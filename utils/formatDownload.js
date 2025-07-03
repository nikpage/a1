// utils/formatDownload.js

export async function formatDownload({
  name,
  email,
  phone,
  address,
  education,
  workExperience,
  skills,
  coverLetter,
  filename,
}) {
  if (!name || !email || !phone || !address || !education || !workExperience || !skills || !coverLetter) {
    console.error("Missing required data fields.");
    return;
  }

  // Build the DOCX structure with the actual data
  const docTemplate = `
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <!-- Contact Information -->
        <w:paragraph>
          <w:r>
            <w:t xml:space="preserve">Name: ${name}</w:t>
          </w:r>
        </w:paragraph>
        <w:paragraph>
          <w:r>
            <w:t xml:space="preserve">Email: ${email}</w:t>
          </w:r>
        </w:paragraph>
        <w:paragraph>
          <w:r>
            <w:t xml:space="preserve">Phone: ${phone}</w:t>
          </w:r>
        </w:paragraph>
        <w:paragraph>
          <w:r>
            <w:t xml:space="preserve">Address: ${address}</w:t>
          </w:r>
        </w:paragraph>

        <!-- Education Section -->
        <w:paragraph>
          <w:r>
            <w:t xml:space="preserve">Education</w:t>
          </w:r>
        </w:paragraph>
        <w:paragraph>
          <w:r>
            <w:t xml:space="preserve">${education}</w:t>
          </w:r>
        </w:paragraph>

        <!-- Work Experience Section -->
        <w:paragraph>
          <w:r>
            <w:t xml:space="preserve">Work Experience</w:t>
          </w:r>
        </w:paragraph>
        <w:paragraph>
          <w:r>
            <w:t xml:space="preserve">${workExperience}</w:t>
          </w:r>
        </w:paragraph>

        <!-- Skills Section -->
        <w:paragraph>
          <w:r>
            <w:t xml:space="preserve">Skills</w:t>
          </w:r>
        </w:paragraph>
        <w:paragraph>
          <w:r>
            <w:t xml:space="preserve">${skills}</w:t>
          </w:r>
        </w:paragraph>

        <!-- Cover Letter Section -->
        <w:paragraph>
          <w:r>
            <w:t xml:space="preserve">Dear Hiring Manager,</w:t>
          </w:r>
        </w:paragraph>
        <w:paragraph>
          <w:r>
            <w:t xml:space="preserve">${coverLetter}</w:t>
          </w:r>
        </w:paragraph>

        <w:paragraph>
          <w:r>
            <w:t xml:space="preserve">Sincerely,</w:t>
          </w:r>
        </w:paragraph>
        <w:paragraph>
          <w:r>
            <w:t xml:space="preserve">${name}</w:t>
          </w:r>
        </w:paragraph>
      </w:body>
    </w:document>
  `;

  // Create a Blob from the DOCX structure
  const blob = new Blob([docTemplate], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

  // Trigger the download
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename || 'downloaded_document.docx';
  link.click();
}
