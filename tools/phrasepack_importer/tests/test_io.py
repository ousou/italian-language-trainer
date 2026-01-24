from phrasepack_importer.io import default_phrasepack_output_path


def test_default_phrasepack_output_path_points_to_repo_public_phrasepacks():
    path = default_phrasepack_output_path("example-pack")
    # Workspace-relative assertion: .../public/phrasepacks/example-pack.json
    assert path.as_posix().endswith("/public/phrasepacks/example-pack.json")

