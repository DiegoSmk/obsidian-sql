import requests
import os
import sys
import subprocess
import re

def get_pr_files(server_url, repo, pr_number, gitea_token):
    """Fetches the list of files changed in the PR."""
    url = f'{server_url}/api/v1/repos/{repo}/pulls/{pr_number}/files'
    headers = {'Authorization': f'token {gitea_token}'}
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print(f"Error fetching PR files: {response.status_code}")
        sys.exit(1)
    return [f['filename'] for f in response.json()]

def get_pr_details(server_url, repo, pr_number, gitea_token):
    """Fetches PR details to get the head branch."""
    url = f'{server_url}/api/v1/repos/{repo}/pulls/{pr_number}'
    headers = {'Authorization': f'token {gitea_token}'}
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print(f"Error fetching PR details: {response.status_code}")
        sys.exit(1)
    return response.json()

def fix_code_with_gemini(info, gemini_key, file_content):
    """Sends code to Gemini for fixing."""
    api_url = f'https://generativelanguage.googleapis.com/v1/models/gemini-3.0-flash:generateContent?key={gemini_key}'
    
    prompt = (
        "You are an expert software engineer. Fix the following code based on best practices, "
        "fixing bugs, and logic errors. \n"
        "IMPORTANT RULES:\n"
        "1. Return ONLY the valid code content of the file.\n"
        "2. Do NOT include Markdown code blocks (```) or language identifiers.\n"
        "3. Do NOT include any explanations, comments, or intro/outro text.\n"
        "4. The output must be ready to save directly to the file.\n\n"
        f"File Content:\n{file_content}"
    )

    payload = {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {'temperature': 0.1} 
    }

    response = requests.post(api_url, json=payload, timeout=60)
    if response.status_code != 200:
        print(f"Gemini API error: {response.text}")
        return None

    try:
        data = response.json()
        text = data['candidates'][0]['content']['parts'][0]['text']
        
        # Cleanup: Remove markdown code blocks if the model ignored the prompt
        text = re.sub(r'^```\w*\n', '', text, flags=re.MULTILINE)
        text = re.sub(r'\n```$', '', text, flags=re.MULTILINE)
        return text.strip()
    except Exception as e:
        print(f"Error parsing Gemini response: {e}")
        return None

def main():
    gemini_key = os.getenv('GEMINI_KEY')
    gitea_token = os.getenv('GITEA_TOKEN')
    server_url = os.getenv('GITEA_SERVER_URL')
    repo = os.getenv('GITEA_REPO')
    pr_number = os.getenv('GITEA_PR_NUMBER')

    if not all([gemini_key, gitea_token, server_url, repo, pr_number]):
        print("Missing environment variables.")
        sys.exit(1)

    print(f"Starting AI Fix for PR #{pr_number}...")

    # 1. Get PR Details (Branch)
    pr_data = get_pr_details(server_url, repo, pr_number, gitea_token)
    head_branch = pr_data['head']['ref']
    clone_url = pr_data['head']['repo']['clone_url'] # Use HTTPS clone val
    
    # Needs auth in clone URL
    auth_clone_url = clone_url.replace('://', f'://{gitea_token}@')

    # 2. Setup Git
    subprocess.run(['git', 'config', '--global', 'user.email', 'actions@gitea.local'], check=True)
    subprocess.run(['git', 'config', '--global', 'user.name', 'Gitea Actions Bot'], check=True)

    # 3. Checkout Branch
    # Since we are likely in a detached HEAD or main, we need to fetch and checkout the PR branch
    print(f"Checking out branch: {head_branch}")
    subprocess.run(['git', 'remote', 'set-url', 'origin', auth_clone_url], check=True)
    subprocess.run(['git', 'fetch', 'origin', head_branch], check=True)
    subprocess.run(['git', 'checkout', head_branch], check=True)

    # 4. Get Modified Files
    files = get_pr_files(server_url, repo, pr_number, gitea_token)
    
    changes_made = False
    
    # Filter files (ignore images, lockfiles, etc)
    ignored_extensions = ['.png', '.jpg', '.zip', '.lock', '.map', '.json'] 
    # Allowing .json mostly, but package-lock.json should stay as is usually.
    
    for filename in files:
        if any(filename.endswith(ext) for ext in ignored_extensions):
            print(f"Skipping ignored file: {filename}")
            continue
        
        if not os.path.exists(filename):
            print(f"File not found (maybe deleted): {filename}")
            continue

        print(f"Processing file: {filename}")
        with open(filename, 'r') as f:
            content = f.read()

        fixed_content = fix_code_with_gemini({'filename': filename}, gemini_key, content)
        
        if fixed_content and fixed_content != content:
            with open(filename, 'w') as f:
                f.write(fixed_content)
            print(f"Applied fixes to {filename}")
            subprocess.run(['git', 'add', filename], check=True)
            changes_made = True
        elif fixed_content == content:
            print(f"No changes suggested for {filename}")
        else:
            print(f"Failed to generate fix for {filename}")

    # 5. Commit and Push
    if changes_made:
        print("Committing changes...")
        subprocess.run(['git', 'commit', '-m', 'refactor: AI Auto-fix applied (Gemini)'], check=True)
        subprocess.run(['git', 'push', 'origin', head_branch], check=True)
        
        # Determine current user/commenter to tag? (Optional - skipping for now)
        comment_body = "### ✅ Fixes Applied\n\nI have applied the suggested fixes to the branch."
    else:
        print("No changes were applied.")
        comment_body = "### ℹ️ Analysis Complete\n\nI analyzed the files but found no objective fixes to apply based on the criteria."

    # 6. Post Comment
    comment_url = f'{server_url}/api/v1/repos/{repo}/issues/{pr_number}/comments'
    requests.post(comment_url, json={'body': comment_body}, headers={'Authorization': f'token {gitea_token}'})

if __name__ == "__main__":
    main()
