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

def fix_code_with_bytez(filename, bytez_api_key, file_content):
    """Sends code to Bytez LLM for fixing."""
    url = "https://api.bytez.com/models/v2/openai/v1/chat/completions"
    
    # Using DeepSeek-V3 via Bytez
    model = "deepseek-ai/DeepSeek-V3"
    
    headers = {
        "Authorization": bytez_api_key,
        "Content-Type": "application/json"
    }

    prompt = (
        f"You are an expert software engineer. Fix the following code in file '{filename}' based on best practices, "
        "fixing bugs, and logic errors. \n"
        "IMPORTANT RULES:\n"
        "1. Return ONLY the valid code content of the file.\n"
        "2. Do NOT include Markdown code blocks (```) or language identifiers.\n"
        "3. Do NOT include any explanations, comments, or intro/outro text.\n"
        "4. The output must be ready to save directly to the file.\n\n"
        f"File Content:\n{file_content}"
    )

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1
    }

    print(f"Sending {filename} to Bytez ({model})...")
    response = requests.post(url, json=payload, headers=headers, timeout=120)
    
    if response.status_code != 200:
        print(f"Bytez API error: {response.status_code} - {response.text}")
        return None

    try:
        data = response.json()
        text = data['choices'][0]['message']['content']
        
        # Cleanup: Remove markdown code blocks if the model ignored the prompt
        text = re.sub(r'^```\w*\n', '', text, flags=re.MULTILINE)
        text = re.sub(r'\n```$', '', text, flags=re.MULTILINE)
        return text.strip()
    except Exception as e:
        print(f"Error parsing Bytez response: {e}")
        return None

def main():
    bytez_api_key = os.getenv('BYTEZ_API')
    gitea_token = os.getenv('GITEA_TOKEN')
    server_url = os.getenv('GITEA_SERVER_URL')
    repo = os.getenv('GITEA_REPO')
    pr_number = os.getenv('GITEA_PR_NUMBER')

    if not all([bytez_api_key, gitea_token, server_url, repo, pr_number]):
        print("Missing environment variables (BYTEZ_API, GITEA_TOKEN, etc).")
        sys.exit(1)

    print(f"Starting Bytez AI Fix for PR #{pr_number}...")

    # 1. Get PR Details
    pr_data = get_pr_details(server_url, repo, pr_number, gitea_token)
    head_branch = pr_data['head']['ref']
    clone_url = pr_data['head']['repo']['clone_url']
    auth_clone_url = clone_url.replace('://', f'://{gitea_token}@')

    # 2. Setup Git
    subprocess.run(['git', 'config', '--global', 'user.email', 'actions@gitea.local'], check=True)
    subprocess.run(['git', 'config', '--global', 'user.name', 'Bytez Actions Bot'], check=True)

    # 3. Checkout Branch
    subprocess.run(['git', 'remote', 'set-url', 'origin', auth_clone_url], check=True)
    subprocess.run(['git', 'fetch', 'origin', head_branch], check=True)
    subprocess.run(['git', 'checkout', head_branch], check=True)

    # 4. Get Modified Files
    files = get_pr_files(server_url, repo, pr_number, gitea_token)
    changes_made = False
    ignored_extensions = ['.png', '.jpg', '.zip', '.lock', '.map', '.json']
    
    for filename in files:
        if any(filename.endswith(ext) for ext in ignored_extensions):
            continue
        
        if not os.path.exists(filename):
            continue

        with open(filename, 'r') as f:
            content = f.read()

        fixed_content = fix_code_with_bytez(filename, bytez_api_key, content)
        
        if fixed_content and fixed_content != content:
            with open(filename, 'w') as f:
                f.write(fixed_content)
            print(f"Applied Bytez fixes to {filename}")
            subprocess.run(['git', 'add', filename], check=True)
            changes_made = True

    # 5. Commit and Push
    if changes_made:
        subprocess.run(['git', 'commit', '-m', 'refactor: Bytez AI Auto-fix applied'], check=True)
        subprocess.run(['git', 'push', 'origin', head_branch], check=True)
        comment_body = "### ✅ Fixes Applied (via Bytez LLM)\n\nI have applied the suggested fixes using the Bytez API."
    else:
        comment_body = "### ℹ️ Bytez Analysis Complete\n\nNo changes were applied."

    # 6. Post Comment
    comment_url = f'{server_url}/api/v1/repos/{repo}/issues/{pr_number}/comments'
    requests.post(comment_url, json={'body': comment_body}, headers={'Authorization': f'token {gitea_token}'})

if __name__ == "__main__":
    main()
