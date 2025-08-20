export default function CustomTable({ page, headers, data, renderCell }) {
  return (
    <table>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h.key}>{h.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((item, idx) => (
          <tr key={item.id || idx}>
            {headers.map((h) => (
              <td key={h.key}>
                {renderCell
                  ? renderCell(item, h.key)
                  : item[h.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}