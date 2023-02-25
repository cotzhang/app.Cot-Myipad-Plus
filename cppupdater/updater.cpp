#include <iostream>
#include <fstream>
#include <cstring>
#include <cstdlib> // for getenv()

using namespace std;

int main() {
	string input_path = getenv("appdata");
	input_path += "\\cmp\\app.asar2";
	ifstream input(input_path, ios::binary);
	ofstream output("app.asar", ios::binary);

	if (!input.is_open()) {
		cout << "Failed to open input file." << endl;
		return 1;
	}

	if (!output.is_open()) {
		cout << "Failed to open output file." << endl;
		return 1;
	}

	char buffer[1024];
	while (input.read(buffer, sizeof(buffer))) {
		output.write(buffer, input.gcount());
	}

	input.close();
	output.close();

	return 0;
}
