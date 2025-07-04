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

  // Build the DOCX structure with added formatting
  const docTemplate = `
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <!-- Header with Contact Info -->
        <w:paragraph>
          <w:r><w:t xml:space="preserve"><w:b>Nik Page</w:b></w:t></w:r>
        </w:paragraph>
        <w:paragraph>
          <w:r><w:t xml:space="preserve">📍 Prague, Czech Republic | 📞 +420 731 647 707 | 📧 Product.Success@Nik.Page</w:t></w:r>
        </w:paragraph>
        <w:paragraph>
          <w:r><w:t xml:space="preserve">🔗 <w:hlink r:href="http://www.linkedin.com/in/nbpage">linkedin.com/in/nbpage</w:hlink> | 🌐 <w:hlink r:href="https://nik.page">nik.page</w:hlink></w:t></w:r>
        </w:paragraph>

        <!-- About Me Section -->
        <w:paragraph>
          <w:r><w:t xml:space="preserve"><w:b>About Me</w:b></w:t></w:r>
        </w:paragraph>
        <w:paragraph>
          <w:r><w:t xml:space="preserve">Hi there! I’m Nik—a product and experience strategist with a passion for turning ideas into meaningful, user-centric solutions. ...</w:t></w:r>
        </w:paragraph>
        <w:paragraph><w:r><w:t xml:space="preserve"> </w:t></w:r></w:paragraph> <!-- Empty line for spacing -->

        <!-- Key Skills Section -->
        <w:paragraph>
          <w:r><w:t xml:space="preserve"><w:b>Key Skills</w:b></w:t></w:r>
        </w:paragraph>
        <w:paragraph>
          <w:r><w:t xml:space="preserve">✨ Leadership & Mentorship – Building teams, coaching talent, and fostering UX maturity.</w:t></w:r>
        </w:paragraph>
        <w:paragraph>
          <w:r><w:t xml:space="preserve">🎨 Product & UX Design – From discovery to delivery, with a focus on human-centered solutions.</w:t></w:r>
        </w:paragraph>
        <w:paragraph><w:r><w:t xml:space="preserve"> </w:t></w:r></w:paragraph> <!-- Empty line for spacing -->

        <!-- Recent Work Experience -->
        <w:paragraph>
          <w:r><w:t xml:space="preserve"><w:b>Recent Work Experience</w:b></w:t></w:r>
        </w:paragraph>
        <w:paragraph>
          <w:r><w:t xml:space="preserve">Product Creator & Experience Designer | Nik Page Experience Strategy & Design (2016–Present)</w:t></w:r>
        </w:paragraph>

        <!-- Education Section -->
        <w:paragraph>
          <w:r><w:t xml:space="preserve"><w:b>Education</w:b></w:t></w:r>
        </w:paragraph>
        <w:paragraph>
          <w:r><w:t xml:space="preserve">🎓 Informatics, Mainframe Programming | Computing Learning Center (1992–1994)</w:t></w:r>
        </w:paragraph>

        <!-- Languages Section -->
        <w:paragraph>
          <w:r><w:t xml:space="preserve"><w:b>Languages</w:b></w:t></w:r>
        </w:paragraph>
        <w:paragraph>
          <w:r><w:t xml:space="preserve">🇬🇧 English (Native) | 🇨🇿 Czech (Working Proficiency)</w:t></w:r>
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
